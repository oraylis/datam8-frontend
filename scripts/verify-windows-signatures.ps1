$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSHOME 'Modules/Microsoft.PowerShell.Security')
Add-Type -AssemblyName System.Security
$sdk = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits/10/bin'
$tool = Get-ChildItem "$sdk/*/x64/signtool.exe" | Sort-Object FullName -Descending | Select-Object -First 1
if (!$tool) { throw 'Windows SDK SignTool is required for embedded-signature verification' }
$files = Get-ChildItem -LiteralPath $env:DATAM8_VERIFY_ROOT -Recurse -File | Where-Object { $_.Extension -match '^\.(exe|dll|node|pyd)$' }
if (!$files) { throw 'No Windows binaries found' }
foreach ($file in $files) {
    # Without catalog-search flags, SignTool validates embedded signatures.
    # /tw makes a missing timestamp a warning; only exit 0 is accepted.
    $report = & $tool.FullName verify /pa /all /tw /v $file.FullName 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Embedded signature verification failed: $($file.FullName)`n$report" }
    $reader = [IO.BinaryReader]::new([IO.File]::OpenRead($file.FullName))
    try {
        $reader.BaseStream.Position = 0x3c
        $pe = $reader.ReadUInt32()
        $reader.BaseStream.Position = $pe
        if ($reader.ReadUInt32() -ne 0x00004550) { throw 'Invalid PE signature' }
        $optional = $pe + 24
        $reader.BaseStream.Position = $optional
        $magic = $reader.ReadUInt16()
        if ($magic -eq 0x20b) { $directories = 112 }
        elseif ($magic -eq 0x10b) { $directories = 96 }
        else { throw 'Unsupported PE optional header' }
        $reader.BaseStream.Position = $optional + $directories + 32
        $offset = $reader.ReadUInt32(); $size = $reader.ReadUInt32()
        if (!$offset -or $size -lt 8 -or $offset + $size -gt $reader.BaseStream.Length) { throw 'Missing or invalid embedded certificate table' }
        $reader.BaseStream.Position = $offset
        $length = $reader.ReadUInt32()
        $revision = $reader.ReadUInt16(); $type = $reader.ReadUInt16()
        if ($length -lt 8 -or $length -gt $size -or $revision -ne 0x200 -or $type -ne 2) { throw 'Invalid embedded PKCS#7 certificate record' }
        $cms = [Security.Cryptography.Pkcs.SignedCms]::new()
        $cms.Decode($reader.ReadBytes($length - 8))
        if ($cms.SignerInfos.Count -ne 1) { throw 'Expected exactly one embedded DataM8 signer' }
        $signer = $cms.SignerInfos[0]
        if ($signer.Certificate.Thumbprint -ne $env:DATAM8_WINDOWS_THUMBPRINT) { throw "Unexpected embedded publisher: $($file.FullName)" }
        if ($signer.DigestAlgorithm.Value -ne '2.16.840.1.101.3.4.2.1') { throw "Expected SHA-256 embedded signature: $($file.FullName)" }
        $timestamps = @($signer.UnsignedAttributes | Where-Object { $_.Oid.Value -in @('1.3.6.1.4.1.311.3.3.1', '1.2.840.113549.1.9.16.2.14') })
        if ($timestamps.Count -ne 1) { throw "Expected RFC-3161 timestamp: $($file.FullName)" }
        $timestamp = [Security.Cryptography.Pkcs.SignedCms]::new()
        $timestamp.Decode($timestamps[0].Values[0].RawData)
        if ($timestamp.SignerInfos.Count -ne 1 -or $timestamp.SignerInfos[0].DigestAlgorithm.Value -ne '2.16.840.1.101.3.4.2.1') { throw 'Expected SHA-256 RFC-3161 timestamp' }
    } finally { $reader.Dispose() }
}
Write-Output "Verified $($files.Count) embedded Windows signatures, expected identity, SHA-256 and RFC-3161 timestamps"

<#
.SYNOPSIS
This script generates Python classes, creates a virtual environment, 
installs necessary packages, builds and installs a Python library, 
generates a command-line tool, and provisions it to a target location.

.DESCRIPTION
This script automates the process of setting up a Python environment 
for generating classes and building a command-line tool. It assumes 
the existence of certain directory structures and files.

.EXAMPLE
./Dm8PostBuildScript.ps1 -WheelVersion 1.0.0
#>

[CmdletBinding()]
Param (
    [Parameter(Mandatory = $false, Position = 1, HelpMessage = "Python Wheel Version Number")]
    [String]$WheelVersion = "1.0.0"
)

Write-Host "##[group]Get datam8-generator"

Write-Host "##[section]Create venv for Windows Embedded package"
python3 -m venv ./venv/

Write-Host "##[section]Install Dm8Data wheel"
# $dm8gen_whl_url = "https://github.com/oraylis/datam8-generator/releases/download/v$WheelVersion/datam8_generator-$WheelVersion-py3-none-any.whl"
# & "./venv/Scripts/pip3" install $dm8gen_whl_url --force-reinstall

$dm8gen_path = "$(Get-ChildItem -Path . -Filter *.whl -Recurse | Select-Object -ExpandProperty FullName)"
write-debug "installting wheel $dm8gen_path"

& "./venv/Scripts/python" -m pip install $dm8gen_path --force-reinstall

Write-Host "##[section]Create Windows embedded runtime"
$pattern = "(([0-9]*)\.([0-9]*)\.[0-9]*)"
$python_version = Invoke-Expression "./venv/Scripts/python --version"
$regex = ($python_version | Select-String -Pattern $pattern).Matches
$version = $($regex.Groups[1].Value)
$ProgressPreference = 'SilentlyContinue'  
Invoke-WebRequest `
    "https://www.python.org/ftp/python/$($version)/python-$($version)-embed-amd64.zip" `
    -OutFile (New-Item -Path `
    "./build/embedded/python-$($version)-embed-amd64.zip" -Force)
Expand-Archive `
    -Path "./build/embedded/python-$($version)-embed-amd64.zip" `
    -DestinationPath "./build/embedded/python-embed-amd64/" -Force

Write-Host "##[section]Put Dm8Data into Windows embedded runtime"
Copy-Item `
    -Path "./venv/Lib/site-packages/" `
    -Destination "./build/embedded/python-embed-amd64/Lib/site-packages/" `
    -Recurse -Force
((Get-Content -path "./build/embedded/python-embed-amd64/python$($regex.Groups[2].Value)$($regex.Groups[3].Value)._pth" `
    -Raw) -replace '#import site', 'import site') | Set-Content `
    -Path "./build/embedded/python-embed-amd64/python$($regex.Groups[2].Value)$($regex.Groups[3].Value)._pth"

$ProgressPreference = 'Continue'

Write-Host "##[endgroup]"

Write-Host "##[group]Provision Windows embedded runtime with Dm8Data to ORAYLIS DataM8 Frontend"
$Source = "./build/embedded/python-embed-amd64/*"
$Destinations = @("./src/Dm8Main/bin/Debug/net8.0-windows7.0/Generator/",
                  "./src/Dm8Main/bin/Debug_Main/net8.0-windows7.0/Generator/")
foreach ($dir in $Destinations) {
    Write-Host "##[section]Deliver Command Line Tool to $dir"
    Copy-Item -Path $Source -Destination $dir -Recurse -Force
}
Write-Host "##[endgroup]"

Write-Host "##[group]Cleanup"
Write-Host "##[section]Deactivate venv"

& ./venv/Scripts/deactivate

Write-Host "##[endgroup]"

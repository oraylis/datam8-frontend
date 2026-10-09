const { spawnSync } = require('node:child_process');
module.exports = async configuration => {
  if (process.env.DATAM8_REQUIRE_SIGNING !== '1') return;
  for (const name of ['AZURE_KEY_VAULT_URL', 'AZURE_KEY_VAULT_NAME', 'KEYVAULT_ACCESS_TOKEN', 'DATAM8_WINDOWS_THUMBPRINT']) {
    if (!process.env[name]) throw new Error(`Required signing configuration missing: ${name}`);
  }
  const args = ['sign', '-kvu', process.env.AZURE_KEY_VAULT_URL, '-kvc', process.env.AZURE_KEY_VAULT_NAME,
    '-kva', process.env.KEYVAULT_ACCESS_TOKEN, '-fd', 'sha256', '-tr', 'http://timestamp.digicert.com', '-td', 'sha256', configuration.path];
  const result = spawnSync('AzureSignTool', args, { encoding: 'utf8', shell: false, windowsHide: true });
  if (result.error || result.status !== 0) {
    const output = `${result.stderr || ''}\n${result.stdout || ''}`.split(process.env.KEYVAULT_ACCESS_TOKEN).join('[redacted]');
    throw new Error(`Azure signing failed: ${result.error?.message || output}`);
  }
};

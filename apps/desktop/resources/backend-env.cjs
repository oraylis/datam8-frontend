const path = require("node:path");

// Shared by the production launcher and the packaged-runtime smoke test.
function buildPythonEnv(pythonPath, runtimeRoot, inherited = process.env, platform = process.platform) {
  const env = { ...inherited, DATAM8_MODE: "electron" };
  const relative = path.relative(path.resolve(runtimeRoot), path.resolve(pythonPath));
  const bundled = relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
  if (bundled) {
    for (const key of ["PYTHONHOME", "PYTHONPATH", "PYTHONUSERBASE", "PYTHONSTARTUP", "VIRTUAL_ENV", "CONDA_PREFIX"]) delete env[key];
    env.PYTHONNOUSERSITE = "1";
    env.PYTHONDONTWRITEBYTECODE = "1";
    if (platform !== "win32") env.PYTHONHOME = path.resolve(runtimeRoot);
  }
  if (platform === "win32") env.PYTHON_KEYRING_BACKEND = "keyring.backends.Windows.WinVaultKeyring";
  return env;
}

module.exports = { buildPythonEnv };

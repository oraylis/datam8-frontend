<#
    Creates the python venv, activates it and installs all required libraries.
    Usage from within PowerShell: `.\01_create_venv.ps1`
#>

# Set variables
$venv_dir = "..\..\.venv"
$requirements_txt_path = $pwd.path + "\..\..\..\automation\DataM8.py\DM8Data.py\requirements.txt"

# Create venv
& python -m venv $venv_dir
Write-Output "venv created."

# Activate venv
& $venv_dir\Scripts\Activate.ps1
Write-Output "venv activated."

# Install required libraries
& python -m pip install -r $requirements_txt_path
Write-Output "Required libraries installed."

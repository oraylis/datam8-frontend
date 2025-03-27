<#
    Create index file for Solution
#>

# Set variables
$activate_venv = ".\01_create_venv.ps1"
$adc_generator = $pwd.path + "\..\..\..\automation\DataM8.py\DM8Data.py\main.py"
$solution_path = "..\..\ORAYLISDatabricksSample.dm8s"

# Activate Virtual Environment
& $activate_venv

# Create Index
python $adc_generator `
    -a validate_index `
    -s $solution_path `
    -i $true

<#
    Start generator for Solution
#>

# Set variables
$create_index = ".\02_create_index.ps1"
$adc_generator = $pwd.path + "\..\..\..\automation\DataM8.py\DM8Data.py\main.py"
$solution_path = "..\..\ORAYLISDatabricksSample.dm8s"
$template_path = "..\databricks-lake"
$output_path = "..\..\Output"
$modules_path = "..\databricks-lake\__modules"
$collections_path = "..\databricks-lake\__collections"

# Create required Index for Solution
& $create_index
Write-Output "Created index."

# Generate Solution Output
python $adc_generator `
    -a generate_template `
    -s $solution_path `
    -src $template_path `
    -dest $output_path `
    -m $modules_path `
    -c $collections_path
        
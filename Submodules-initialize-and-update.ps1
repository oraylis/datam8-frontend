# Initialize and update all submodules
Write-Host "Initializing and updating submodules..."

try {
    git submodule init
    git submodule update --recursive --remote
    Write-Host "Submodules initialized and updated successfully."
} catch {
    Write-Error "An error occurred while initializing or updating submodules: $_"
}
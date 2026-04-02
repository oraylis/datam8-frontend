write-host "Initializing and updating submodules..."

try {
    git submodule init
    git submodule update --recursive --remote
    write-host "Submodules initialized and updated successfully."
} catch {
    write-error "An error occured while Initializing or updating submoUles: $_"
}

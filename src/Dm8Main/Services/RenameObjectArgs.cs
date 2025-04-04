using Dm8Main.Models;

namespace Dm8Main.Services
{
    public class RenameObjectArgs
    {
        public string OriginalFilePath { get; set; }

        public ProjectItem ProjectItem { get; set; }
    }
}

using Dm8Data.Raw;
using Dm8Main.Models;

namespace Dm8Main.ViewModels
{
    public class EntitySelect : Prism.Mvvm.BindableBase
    {
        #region Property IsSelected
        public bool IsSelected
        {
            get => this.isSelected;
            set => this.SetProperty(ref this.isSelected, value);
        }

        public bool isSelected;
        #endregion

        #region Property ItemType
        public ProjectItem.Types ItemType
        {
            get => this.itemType;
            set => this.SetProperty(ref this.itemType, value);
        }

        public ProjectItem.Types itemType;
        #endregion

        #region Property Name
        public string Name
        {
            get => this.name;
            set => this.SetProperty(ref this.name, value);
        }

        public string name;
        #endregion

        #region Property RelativePath
        public string RelativePath
        {
            get => this.relativePath;
            set => this.SetProperty(ref this.relativePath, value);
        }

        public string relativePath;
        #endregion

        #region Property FilePath
        public string FilePath
        {
            get => this.filePath;
            set => this.SetProperty(ref this.filePath, value);
        }

        public string filePath;
        #endregion    
    }
}

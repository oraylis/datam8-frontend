using System;
using System.Composition;

namespace Dm8Main.ViewModels
{
    [Export]
    public class ViewModelBase : Prism.Mvvm.BindableBase, IDisposable
    {
        #region Property Title
        public string Title
        {
            get => this.title;
            set => this.SetProperty(ref this.title, value);
        }

        private string title;
        #endregion

        #region Property ContentId
        public string ContentId
        {
            get => this.contentId;
            set => this.SetProperty(ref this.contentId, value);
        }

        private string contentId;
        #endregion

        #region Property IsSelected
        public bool IsSelected
        {
            get => this.isSelected;
            set => this.SetProperty(ref this.isSelected, value);
        }

        private bool isSelected;
        #endregion

        #region Property IsModified
        public bool IsModified
        {
            get => this.isModified;
            set => this.SetProperty(ref this.isModified, value);
        }

        private bool isModified;
        #endregion

        public ViewModelBase()
        {
            this.ContentId = "Type$" + this.GetType().Name;
        }

        public virtual void Dispose()
        {      
            
        }
    }
}
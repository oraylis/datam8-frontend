using System;
using System.Collections.Generic;
using System.Composition;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Prism.Commands;

namespace Dm8Main.ViewModels
{
    [Export]
    public abstract class AnchorViewModel : ViewModelBase
    {
        public event Action Closed;

        #region Property HideCommand
        public DelegateCommand HideCommand
        {
            get => this.hideCommand;
            set => this.SetProperty(ref this.hideCommand, value);
        }

        public DelegateCommand hideCommand;

        #endregion

        public AnchorViewModel()
        {
            this.Closed += this.AnchorViewModel_Closed;
            this.HideCommand = new DelegateCommand(() => this.Hide());
            this.IsModified = false;
        }

        private void AnchorViewModel_Closed()
        {
            
        }

        private void Hide()
        {
            this.Closed.Invoke();
        }

        public abstract Task SaveAsync();
    }
}

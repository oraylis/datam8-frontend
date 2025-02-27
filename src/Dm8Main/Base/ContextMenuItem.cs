using System.Drawing;
using System.Windows.Controls;
using System.Windows.Input;
using Prism.Commands;

namespace Dm8Main.Base
{
    public class ContextMenuItem : Prism.Mvvm.BindableBase
    {
        #region Property Icon
        public Control Icon
        {
            get => this.icon;
            set => this.SetProperty(ref this.icon, value);
        }

        private Control icon;
        #endregion

        #region Property Header
        public string Header
        {
            get => this.header;
            set => this.SetProperty(ref this.header, value);
        }

        private string header;
        #endregion

        #region Property InputGestureText
        public string InputGestureText
        {
            get => this.inputGestureText;
            set => this.SetProperty(ref this.inputGestureText, value);
        }

        private string inputGestureText;
        #endregion
        
        #region Property Command
        public DelegateCommand Command
        {
            get => this.command;
            set => this.SetProperty(ref this.command, value);
        }

        private DelegateCommand command;
        #endregion
    }
}
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading.Tasks;
using static Unity.Storage.RegistrationSet;

namespace Dm8Main.Base
{
    public class CheckableContent<T> : Prism.Mvvm.BindableBase where T : Prism.Mvvm.BindableBase
    {
        public CheckableContent() => this.Content = null;

        public CheckableContent(T content) => this.Content = content;

        #region Property IsChecked
        public bool IsChecked
        {
            get => this.isChecked;
            set
            {
                if (this.isChecked != value)
                {
                    this.isChecked = value;
                    RaiseCheckableChanged();
                }
            }
        }
        private bool isChecked;

        #endregion

        #region Property Content

        public T Content
        {
            get => this.content;
            set
            {
                if (this.content != null)
                    this.content.PropertyChanged -= this.OnPropertyChanged;
                this.SetProperty(ref this.content, value);
                if (this.content != null)
                    this.content.PropertyChanged += this.OnPropertyChanged;
            }
        }
        private T content;

        private void OnPropertyChanged(object? sender, PropertyChangedEventArgs e)
        {
            this.RaisePropertyChanged(nameof(this.Content));
        }
        #endregion

        #region Checkable Changed
        private void RaiseCheckableChanged()
        {
            OnCheckableChanged(new PropertyChangedEventArgs("IsChecked"));
        }
        protected virtual void OnCheckableChanged(PropertyChangedEventArgs args)
        {
            CheckableChanged?.Invoke(this, args);
        }
        public event PropertyChangedEventHandler CheckableChanged;
        #endregion
    }
}

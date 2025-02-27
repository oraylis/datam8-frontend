using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using Dm8Main.Base;
using Prism.Commands;

namespace Dm8Main.Views
{
    public class MainWindowBase : MahApps.Metro.Controls.MetroWindow
    {
        #region Dependency Properties for Theme
        public ColorTheme Theme
        {
            get => (ColorTheme)this.GetValue(ThemeProperty);
            set => this.SetValue(ThemeProperty, value);
        }

        public static readonly DependencyProperty ThemeProperty =
            DependencyProperty.Register("Theme", typeof(ColorTheme), typeof(MainWindowBase), new PropertyMetadata((d, e) => (d as MainWindowBase).ThemeChanged(e)));


        public virtual void ThemeChanged(DependencyPropertyChangedEventArgs e)
        {
        }
        #endregion

        #region DelegateCommand
        public DelegateCommand<AvalonDock.DocumentClosingEventArgs> DocumentClosingCommand
        {
            get => (DelegateCommand<AvalonDock.DocumentClosingEventArgs>)this.GetValue(DocumentClosingCommandProperty);
            set => this.SetValue(DocumentClosingCommandProperty, value);
        }

        // Using a DependencyProperty as the backing store for DocumentClosingCommand.  This enables animation, styling, binding, etc...
        public static readonly DependencyProperty DocumentClosingCommandProperty =
            DependencyProperty.Register("DocumentClosingCommand", typeof(DelegateCommand<AvalonDock.DocumentClosingEventArgs>), typeof(MainWindowBase), new PropertyMetadata(null));
        #endregion
    }
}

using System;
using System.ComponentModel;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Navigation;
using Dm8Main.Base;
using Dm8Main.ViewModels;
using Dm8Main.ViewModels.Dialog;
using MahApps.Metro.Controls;
using MvvmDialogs;
using MenuItem = Dm8Main.ViewModels.MenuItem;

namespace Dm8Main.Views.Dialog
{
    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class DlgCoreAttributeAssign : MetroWindow, IClosableWindow
    {
        public new ContentControl Owner
        {
            get => base.Owner;
            set => base.Owner = value as Window;
        }

        public DlgCoreAttributeAssignViewModel ViewModel => (this.DataContext as DlgCoreAttributeAssignViewModel)!;

        public DlgCoreAttributeAssign()
        {
            this.InitializeComponent();
            DialogServiceViews.SetIsRegistered(this, true);
            this.RestoreState(Properties.Settings.Default.DlgCoreAttributeEditSettings);
        }


        private void DlgCoreEntityAdd_OnLoaded(object sender, RoutedEventArgs e)
        {
            this.ViewModel.PropertyChanged += ViewModelOnPropertyChanged;
        }

        private void DlgCoreEntityAdd_OnClosing(object? sender, CancelEventArgs e)
        {
            Properties.Settings.Default.DlgCoreAttributeEditSettings = this.StoreState();
            Properties.Settings.Default.Save();
        }

        private void ViewModelOnPropertyChanged(object? sender, PropertyChangedEventArgs e)
        {
        }
    }
}
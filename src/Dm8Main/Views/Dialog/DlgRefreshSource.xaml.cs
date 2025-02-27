using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using Dm8Main.Base;
using Dm8Main.ViewModels;
using Dm8Main.ViewModels.Dialog;
using MahApps.Metro.Controls;
using MvvmDialogs;

namespace Dm8Main.Views.Dialog
{
    /// <summary>
    /// Interaction logic for SourceTableAddView.xaml
    /// </summary>
    public partial class DlgRefreshSource : HamburgerWizard
    {
        public override IHamburgerViewModel ViewModel => this.DataContext as IHamburgerViewModel;
        public override HamburgerMenu HamburgerMenuControlProp => this.HamburgerMenuControl;
        public override Button ButtonPrevProp => this.ButtonBack;
        public override Button ButtonNextProp => this.ButtonNext;
        public override Button ButtonOK => this.OKButton;

        public new ContentControl Owner
        {
            get => base.Owner;
            set => base.Owner = value as Window;
        }

        public DlgRefreshSource()
        {
            this.InitializeComponent();
            DialogServiceViews.SetIsRegistered(this, true);
        }


        private void ButtonDb_Checked(object sender, RoutedEventArgs e)
        {
            if (this.ButtonTable != null)
            {
                this.ButtonTable.IsChecked = false;
                this.DataGrid.IsEnabled = false;
                this.DataGrid.SelectedItem = null;
            }
        }

        private void ButtonTable_Checked(object sender, RoutedEventArgs e)
        {
            if (this.ButtonDb != null)
            {
                this.ButtonDb.IsChecked = false;
                this.DataGrid.IsEnabled = true;
            }
        }
    }
}

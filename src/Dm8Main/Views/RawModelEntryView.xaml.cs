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
using System.Windows.Navigation;
using System.Windows.Shapes;
using Dm8Main.ViewModels;
using Fluent;
using MahApps.Metro.Controls;

namespace Dm8Main.Views
{
    /// <summary>
    /// Interaction logic for AttributeTypesView.xaml
    /// </summary>
    public partial class RawModelEntryView : DocumentView, IRawModelEntryView
    {
        public RawModelEntryView(RawModelEntryViewModel sourceEntityView)
        {
            this.InitializeComponent();
            this.DataContext = sourceEntityView;
        }

        private void HamburgerMenuControl_OnItemInvoked(object sender, HamburgerMenuItemInvokedEventArgs e)
        {
            if (e.InvokedItem is HamburgerMenuItem menuItem && menuItem.Tag is Grid)
            {
                this.HamburgerMenuControl.Content = menuItem.Tag as Grid;
            }
        }
    }
}

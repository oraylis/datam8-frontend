using System.Composition;
using System.Windows.Controls;
using Dm8Data;
using Dm8Main.Models;
using Dm8Main.Services;
using Dm8Main.ViewModels;
using MahApps.Metro.Controls;
using PropertyTools.Wpf;


namespace Dm8Main.Views
{
    /// <summary>
    /// Interaction logic for ProjectView.xaml
    /// </summary>
    public partial class DiagramView : DocumentView, IDiagramView
    {
        [ImportingConstructor]
        public DiagramView(DiagramViewModel diagramViewModel)
        {
            this.InitializeComponent();
            this.DataContext = diagramViewModel;            
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

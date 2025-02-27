using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Input;
using Dm8Main.ViewModels;
using ICSharpCode.AvalonEdit.Search;
using MahApps.Metro.Controls;

namespace Dm8Main.Views
{
    /// <summary>
    /// Interaction logic for AttributeTypesView.xaml
    /// </summary>
    public partial class CuratedFunctionView : HamburgerMenuIconItem
    {
        public object DataContext { get; set; }

        public CuratedFunctionView(CuratedFunctionViewModel curatedFunctionViewModel)
        {
            this.InitializeComponent();
            this.DataContext = curatedFunctionViewModel;
            this.FunctionGrid.DataContext = curatedFunctionViewModel;
        }

    }
}

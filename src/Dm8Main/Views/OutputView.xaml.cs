using System;
using System.Collections.Generic;
using System.Composition;
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
namespace Dm8Main.Views
{
    /// <summary>
    /// Interaction logic for ProjectView.xaml
    /// </summary>
    public partial class OutputView : UserControl, IAnchorView
    {
        [ImportingConstructor]
        public OutputView(OutputViewModel projectViewModel)
        {
            this.InitializeComponent();
            this.DataContext = projectViewModel;
        }

        public AnchorViewModel ViewModel => (AnchorViewModel)this.DataContext;

        private void TextBox_TextChanged(object sender, TextChangedEventArgs e)
        {
            this.OutputTextBox.ScrollToEnd();
        }
    }
}

using System.Composition;
using System.Windows.Controls;
using Dm8Main.ViewModels;
using ICSharpCode.AvalonEdit.Search;

namespace Dm8Main.Views
{
    /// <summary>
    /// Interaction logic for ProjectView.xaml
    /// </summary>
    public partial class GeneratorFileView : UserControl, IGeneratorFileView
    {
        [ImportingConstructor]
        public GeneratorFileView(GeneratorFileViewModel projectViewModel)
        {
            this.InitializeComponent();
            this.DataContext = projectViewModel;
            SearchPanel.Install(this.Edit);
        }

        public DocumentViewModelBase ViewModel => (DocumentViewModelBase)this.DataContext;
    }
}

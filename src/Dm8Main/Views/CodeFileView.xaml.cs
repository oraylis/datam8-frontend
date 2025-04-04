using System.Composition;
using System.Windows.Controls;
using Dm8Main.ViewModels;
using ICSharpCode.AvalonEdit.Search;

namespace Dm8Main.Views
{
    /// <summary>
    /// Interaction logic for ProjectView.xaml
    /// </summary>
    public partial class CodeFileView : UserControl, ICodeFileView
    {
        [ImportingConstructor]
        public CodeFileView(CodeFileViewModel projectViewModel)
        {
            this.InitializeComponent();
            this.DataContext = projectViewModel;
            SearchPanel.Install(this.Edit);
        }

        public DocumentViewModelBase ViewModel => (DocumentViewModelBase)this.DataContext;
    }
}

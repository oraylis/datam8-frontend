using System.Composition;
using System.Windows.Controls;
using Dm8Data;
using Dm8Main.Models;
using Dm8Main.Services;
using Dm8Main.ViewModels;
using PropertyTools.Wpf;


namespace Dm8Main.Views
{
    /// <summary>
    /// Interaction logic for ProjectView.xaml
    /// </summary>
    public partial class ProjectView : UserControl, IAnchorView
    {
        [ImportingConstructor]
        public ProjectView(ProjectViewModel projectViewModel)
        {
            this.InitializeComponent();
            this.DataContext = projectViewModel;            
        }

        public AnchorViewModel ViewModel => (ProjectViewModel)this.DataContext;

        private void TreeListBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (this.projectTree.SelectedItem is ProjectItem projectItem)
            {
                ProjectViewModel pvm = (ProjectViewModel)this.DataContext;
                pvm.ItemSelect(projectItem);

                this.InputBindings.Clear();
                this.InputBindings.AddRange(projectItem.InputBindings);
            }


        }
    }
}

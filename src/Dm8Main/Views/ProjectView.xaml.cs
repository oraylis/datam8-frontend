using System;
using System.Composition;
using System.Windows.Controls;
using Dm8Main.ViewModels;
using PropertyTools.Wpf;
using ProjectItem = Dm8Main.Models.ProjectItem;


namespace Dm8Main.Views
{
   /// <summary>
   /// Interaction logic for ProjectView.xaml
   /// </summary>
   public partial class ProjectView:UserControl, IAnchorView
   {
      [ImportingConstructor]
      public ProjectView(ProjectViewModel projectViewModel)
      {
         this.InitializeComponent();
         this.DataContext = projectViewModel;
      }

      public AnchorViewModel ViewModel => (ProjectViewModel)this.DataContext;
      private ProjectItem _lastSelectedItem = null;
      private ProjectItem _lastChangedItem = null;
      private void TreeListBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
      {
         if(this.projectTree.SelectedItem is ProjectItem projectItem)
         {
            if(_lastChangedItem == projectItem)
            {
               return;
            }
            try
            {
               _lastChangedItem = projectItem;
               ProjectViewModel pvm = (ProjectViewModel)this.DataContext;
               pvm.ItemSelect(projectItem);
               this.InputBindings.Clear();
               this.InputBindings.AddRange(projectItem.InputBindings);
               this.projectTree.ScrollIntoView(projectItem);
            } catch(Exception ex)
            {
               Console.WriteLine(ex.ToString());
            }
         }
      }
      public void SelectProjectItem(ProjectItem item, bool multiSelect)
      {
         if(_lastSelectedItem == item)
         {
            return;
         }
         _lastSelectedItem = item;
         ProjectViewModel pvm = (ProjectViewModel)this.DataContext;
         pvm.SelectProjectItem(item, multiSelect);
         this.projectTree.ScrollIntoView(item);
      }

   }
}

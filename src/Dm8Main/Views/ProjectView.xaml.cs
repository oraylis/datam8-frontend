/* DataM8
 * Copyright (C) 2024-2025 ORAYLIS GmbH
 *
 * This file is part of DataM8.
 *
 * DataM8 is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * DataM8 is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

using System;
using System.Composition;
using System.Windows.Controls;
using Dm8Main.ViewModels;
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
      private void TreeListBox_SelectionChanged(object sender ,SelectionChangedEventArgs e)
      {
         if (this.projectTree.SelectedItem is ProjectItem projectItem)
         {
            if (_lastChangedItem == projectItem)
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
            } catch (Exception ex)
            {
               Console.WriteLine(ex.ToString());
            }
         }
      }
      public void SelectProjectItem(ProjectItem item ,bool multiSelect)
      {
         if (_lastSelectedItem == item)
         {
            return;
         }
         _lastSelectedItem = item;
         ProjectViewModel pvm = (ProjectViewModel)this.DataContext;
         pvm.SelectProjectItem(item ,multiSelect);
         this.projectTree.ScrollIntoView(item);
      }

   }
}

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
#pragma warning disable CS8073 // The result of the expression is always the same since a value of this type is never equal to 'null'

   /// <summary>
   /// Interaction logic for AttributeTypesView.xaml
   /// </summary>
   public partial class CoreModelEntryView:DocumentView, ICoreModelEntryView
   {

      public CoreModelEntryView(CoreModelEntryViewModel coreModelEntryView)
      {
         this.InitializeComponent();
         this.DataContext = coreModelEntryView;
         SearchPanel.Install(this.EditSqlCompute);
      }

      private void HamburgerMenuControl_OnItemInvoked(object sender ,HamburgerMenuItemInvokedEventArgs e)
      {
         if (e.InvokedItem is HamburgerMenuItem menuItem && menuItem.Tag is Grid)
         {
            this.HamburgerMenuControl.Content = menuItem.Tag as Grid;
         }
      }

      private void EditGrid_OnSelectedCellsChanged(object sender ,SelectedCellsChangedEventArgs e)
      {
         if (e.AddedCells.Any())
         {
            this.editGrid.BeginEdit();
         }
      }

      private void EditGrid_CellKeyDown(object sender ,KeyEventArgs e)
      {
#pragma warning disable CS8073 // The result of the expression is always the same since a value of this type is never equal to 'null'
         if (this.editGrid.CurrentCell == null)
         {
            return;
         }
#pragma warning restore CS8073 // The result of the expression is always the same since a value of this type is never equal to 'null'

         switch (e.Key)
         {
            case Key.Tab:
               // tab is handled by this function
               e.Handled = true;
               this.editGrid.CommitEdit();

               object itemTab = this.editGrid.CurrentCell.Item;
               var colIdx = this.editGrid.CurrentCell.Column.DisplayIndex;

               if (Keyboard.IsKeyDown(Key.LeftShift))
               {
                  colIdx--;
                  if (colIdx < 0)
                  {
                     itemTab = this.EditGrid_SelectPreviousRow(sender);
                     colIdx = this.editGrid.Columns.Count - 1;
                  }
               } else
               {
                  colIdx++;
                  if (colIdx >= this.editGrid.Columns.Count)
                  {
                     itemTab = this.EditGrid_SelectNextRow(sender);
                     colIdx = 0;
                  }
               }

               if (0 <= colIdx && colIdx < this.editGrid.Columns.Count)
               {
                  if (itemTab != null)
                  {
                     var nextColumn = this.editGrid.ColumnFromDisplayIndex(colIdx);
                     this.editGrid.CurrentCell = new DataGridCellInfo(itemTab ,nextColumn);
                     this.editGrid.BeginEdit();
                  }
               }
               break;

            case Key.Enter:
               // enter is handled by this function
               e.Handled = true;
               this.editGrid.CommitEdit();

               var itemEnter = this.EditGrid_SelectNextRow(sender);
               if (itemEnter != null)
               {
                  this.editGrid.CurrentCell = new DataGridCellInfo(itemEnter ,this.editGrid.CurrentCell.Column);
                  this.editGrid.BeginEdit();
               }
               break;
         }
      }


      private void EditGrid_OnPreviewKeyDown(object sender ,KeyEventArgs e)
      {
         // TODO - check if combobox is open
         // TODO - Space and Enter open dialog on button

         switch (e.Key)
         {
            case Key.Enter:
            case Key.Space:
               {
                  var currentCell = this.editGrid.CurrentCell;
                  if (this.EditCommand != null && this.EditCommand.CanExecute(currentCell))
                  {
                     this.EditCommand.Execute(currentCell);
                  }
               }
               break;

            case Key.Up:
               // up is handled by this function
               e.Handled = true;
               this.editGrid.CommitEdit();
               var itemPrevious = this.EditGrid_SelectPreviousRow(sender);
               if (itemPrevious != null)
               {
                  var currentCell = this.editGrid.CurrentCell;
                  this.editGrid.CurrentCell = new DataGridCellInfo(itemPrevious ,currentCell.Column);
                  this.editGrid.BeginEdit();
               }
               break;

            case Key.Down:
               // down is handled by this function
               e.Handled = true;
               this.editGrid.CommitEdit();
               var itemNext = this.EditGrid_SelectNextRow(sender);
               if (itemNext != null)
               {
                  var currentCell = this.editGrid.CurrentCell;
                  this.editGrid.CurrentCell = new DataGridCellInfo(itemNext ,currentCell.Column);
                  this.editGrid.BeginEdit();
               }
               break;
         }
      }

      private void EditGrid_OnCellEditEnding(object? sender ,DataGridCellEditEndingEventArgs e)
      {
         if (e.EditAction == DataGridEditAction.Commit)
         {
            if (e.EditingElement is FrameworkElement frameworkElement)
            {
               foreach (var be in frameworkElement.BindingGroup.BindingExpressions)
               {
                  be.UpdateSource();
               }
            }
         }
      }


      private object EditGrid_SelectPreviousRow(object sender)
      {
         if (this.editGrid.ItemsSource is ListCollectionView listCollectionView)
         {
            var currentItem = listCollectionView.CurrentEditItem;
            if (currentItem == null)
            {
               currentItem = listCollectionView.CurrentItem;
            }
            listCollectionView.CommitEdit();
            this.editGrid.UnselectAllCells();
            listCollectionView.MoveCurrentTo(currentItem);
            listCollectionView.MoveCurrentToPrevious();
            var prevItem = listCollectionView.CurrentItem;
            return prevItem;
         }

         return null;
      }

      private object EditGrid_SelectNextRow(object sender)
      {
         if (this.editGrid.ItemsSource is ListCollectionView listCollectionView)
         {
            var currentItem = listCollectionView.CurrentEditItem;
            if (currentItem == null)
            {
               currentItem = listCollectionView.CurrentItem;
            }
            listCollectionView.CommitEdit();
            this.editGrid.UnselectAllCells();
            listCollectionView.MoveCurrentTo(currentItem);
            listCollectionView.MoveCurrentToNext();
            var nextItem = listCollectionView.CurrentItem;
            return nextItem;
         }

         return null;
      }
      private void SelectAllSource_OnClick(object sender ,RoutedEventArgs e)
      {
         CheckBox c = sender as CheckBox;
         if (c != null)
         {
            bool set = (bool)c.IsChecked;
            CoreModelEntryViewModel dm = this.DataContext as CoreModelEntryViewModel;

            var list = dm.MappedAttributes;
            foreach (var item in list)
            {
               item.IsChecked = set;
            }
            var dg = DataGridMappedAttributes;
            dg.Items.Refresh();
         }
      }

      private void SelectAllTarget_OnClick(object sender ,RoutedEventArgs e)
      {
         CheckBox c = sender as CheckBox;
         if (c != null)
         {
            bool set = (bool)c.IsChecked;
            CoreModelEntryViewModel dm = this.DataContext as CoreModelEntryViewModel;

            var list = dm.NotMappedAttributes;
            foreach (var item in list)
            {
               item.IsChecked = set;
            }
            var dg = DataGridNotMappedAttributes;
            dg.Items.Refresh();
         }
      }
   }
}

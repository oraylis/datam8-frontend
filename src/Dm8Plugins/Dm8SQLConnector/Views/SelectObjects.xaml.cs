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

using System.ComponentModel;
using System.Windows;
using Oraylis.DataM8.PluginBase.BaseClasses;

namespace Dm8LakeConnector.Views
{
#pragma warning disable CS8604

   public partial class SelectObjects:Window
   {
      public SelectObjects()
      {
         InitializeComponent();
         OkButton.IsEnabled = false;
      }

      #region Entities
      public IList<RawModelEntryBase> Entities
      {
         get
         {
            List<RawModelEntryBase> retVal = new List<RawModelEntryBase>();
            foreach (DisplayObject<RawModelEntryBase> itm in GridObjects.Items)
            {
               if (itm.IsChecked)
               {
                  retVal.Add(itm.Cargo);
               }
            }

            return (retVal);
         }
         set
         {
            _entities = value;
            loadGrid();
         }
      }
      private IList<RawModelEntryBase> _entities = new List<RawModelEntryBase>();
      #endregion

      public DisplayObject<RawModelEntryBase> SelectedObject
      {
         get
         {
            return (_selectedObject);
         }
         set
         {
            _selectedObject = value;
         }
      }
      private DisplayObject<RawModelEntryBase> _selectedObject = new DisplayObject<RawModelEntryBase>();
      public IList<DisplayObject<RawModelEntryBase>> Data
      {
         get
         {
            return (_data);
         }
      }
      private IList<DisplayObject<RawModelEntryBase>> _data = new List<DisplayObject<RawModelEntryBase>>();

      private void CancelButton_OnClick(object sender ,RoutedEventArgs e)
      {
         this.DialogResult = false;
      }

      private void OkButton_OnClick(object sender ,RoutedEventArgs e)
      {
         this.DialogResult = true;
      }
      private void loadGrid()
      {
         foreach (var item in _entities)
         {
            DisplayObject<RawModelEntryBase> obj = new DisplayObject<RawModelEntryBase>();
            obj.Name = item.Entity.Name;
            obj.DisplayName = item.Entity.DisplayName;
            obj.Schema = item.Schema;
            obj.Type = item.Entity.ObjectType;
            obj.Source = item.Function.SourceLocation;
            obj.Cargo = item;

            obj.CheckableChanged += EntryCheckableChanged;

            _data.Add(obj);
         }
         GridObjects.ItemsSource = _data;
      }
      private void MenuItem_SelectAll(object sender ,RoutedEventArgs e)
      {
         foreach (var obj in _data)
         {
            obj.IsChecked = true;
         }
         GridObjects.Items.Refresh();
         GridObjects.SelectedItem = GridObjects.Items[0];
      }
      private void MenuItem_UnSelectAll(object sender ,RoutedEventArgs e)
      {
         foreach (var obj in _data)
         {
            obj.IsChecked = false;
         }
         GridObjects.Items.Refresh();
         GridObjects.SelectedItem = GridObjects.Items[0];
      }
      private void EntryCheckableChanged(object? sender ,PropertyChangedEventArgs e)
      {
         OkButton.IsEnabled = _data.Any(x => x.IsChecked);
      }
   }
}

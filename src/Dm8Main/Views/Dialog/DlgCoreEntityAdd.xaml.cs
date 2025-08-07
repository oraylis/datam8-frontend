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

using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using Dm8Main.Base;
using Dm8Main.ViewModels;
using Dm8Main.ViewModels.Dialog;
using MahApps.Metro.Controls;
using MvvmDialogs;

namespace Dm8Main.Views.Dialog
{
   /// <summary>
   /// Interaction logic for MainWindow.xaml
   /// </summary>
   public partial class DlgCoreEntityAdd:MetroWindow, IClosableWindow
   {
      public new ContentControl Owner
      {
         get => base.Owner;
         set => base.Owner = value as Window;
      }

      public DlgCoreEntityAddViewModel ViewModel => (this.DataContext as DlgCoreEntityAddViewModel)!;

      public DlgCoreEntityAdd()
      {
         this.InitializeComponent();
         DialogServiceViews.SetIsRegistered(this ,true);
         this.RestoreState(Properties.Settings.Default.DlgCoreEntityAddSettings);
      }


      private void DlgCoreEntityAdd_OnLoaded(object sender ,RoutedEventArgs e)
      {
         this.ViewModel.PropertyChanged += ViewModelOnPropertyChanged;
      }



      private void DlgCoreEntityAdd_OnClosing(object? sender ,CancelEventArgs e)
      {
         Properties.Settings.Default.DlgCoreEntityAddSettings = this.StoreState();
         Properties.Settings.Default.Save();
      }
      private void ViewModelOnPropertyChanged(object? sender ,PropertyChangedEventArgs e)
      {
         if (e.PropertyName == nameof(this.ViewModel.NumSelectablePages))
         {
            this.EnableButtons();
         }
      }

      private void HamburgerMenuControl_OnItemInvoked(object sender ,HamburgerMenuItemInvokedEventArgs e)
      {
         if (e.InvokedItem is HamburgerMenuItem menuItem && menuItem.Tag is Grid)
         {
            this.HamburgerMenuControl.Content = menuItem.Tag as Grid;
            this.EnableButtons();
         }
      }

      private void EnableButtons()
      {
         for (int i = 0; i < this.ViewModel.NumSelectablePages && i < this.HamburgerMenuControl.Items.Count; i++)
         {
            (this.HamburgerMenuControl.Items.GetItemAt(i) as HamburgerMenuItem).IsEnabled = true;
         }

         for (int i = this.ViewModel.NumSelectablePages; i < this.HamburgerMenuControl.Items.Count; i++)
         {
            (this.HamburgerMenuControl.Items.GetItemAt(i) as HamburgerMenuItem).IsEnabled = false;
         }

         this.GetPrevNextItem(out HamburgerMenuItem prevItem ,out HamburgerMenuItem nextItem);
         if (prevItem == null)
         {
            this.ButtonBack.IsEnabled = false;
         } else
         {
            this.ButtonBack.IsEnabled = true;
         }

         if (nextItem == null)
         {
            this.ButtonNext.Visibility = Visibility.Hidden;
            this.ButtonNext.Width = 0;
            this.OkButton.Visibility = Visibility.Visible;
            this.OkButton.Width = 80;
         } else
         {
            this.ButtonNext.Visibility = Visibility.Visible;
            this.ButtonNext.Width = 80;
            this.OkButton.Visibility = Visibility.Hidden;
            this.OkButton.Width = 0;
         }
      }

      private void GetPrevNextItem(out HamburgerMenuItem prevItem ,out HamburgerMenuItem nextItem)
      {
         bool foundSelected = false;
         prevItem = null;
         nextItem = null;


         foreach (var i in this.HamburgerMenuControl.Items.OfType<HamburgerMenuItem>())
         {
            if (foundSelected)
            {
               nextItem = i;
               break;
            }

            if (i == this.HamburgerMenuControl.SelectedItem)
            {
               foundSelected = true;
            } else
            {
               i.IsEnabled = true;
               prevItem = i;
            }
         }
      }

      private void ButtonPrev_Click(object sender ,RoutedEventArgs e)
      {
         this.GetPrevNextItem(out HamburgerMenuItem prevItem ,out HamburgerMenuItem nextItem);
         if (prevItem != null)
            this.HamburgerMenuControl.SelectedItem = prevItem;
      }

      private void ButtonNext_Click(object sender ,RoutedEventArgs e)
      {
         this.GetPrevNextItem(out HamburgerMenuItem prevItem ,out HamburgerMenuItem nextItem);
         if (nextItem != null)
            this.HamburgerMenuControl.SelectedItem = nextItem;
      }

      private void GoBack_OnClick(object sender ,RoutedEventArgs e)
      {
         // this.navigationServiceEx.GoBack();
      }

      private void SelectAll_OnClick(object sender ,RoutedEventArgs e)
      {
         CheckBox c = sender as CheckBox;

         if (c != null)
         {
            bool set = (bool)c.IsChecked;
            DlgCoreEntityAddViewModel dm = ((DlgCoreEntityAddViewModel)this.DataContext);

            ObservableCollection<EntitySelect> list = dm.Entities;
            foreach (var item in list)
            {
               item.isSelected = set;
            }

            dm.IsNextEnabled = set;
            dm.NumSelectablePages = set ? 2 : 1;

            var dg = DataGridMaster;
            dg.Items.Refresh();
         }
      }
   }
}
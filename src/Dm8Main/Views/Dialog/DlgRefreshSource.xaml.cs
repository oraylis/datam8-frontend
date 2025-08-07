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

using System.Windows;
using System.Windows.Controls;
using Dm8Main.ViewModels.Dialog;
using MahApps.Metro.Controls;
using MvvmDialogs;

namespace Dm8Main.Views.Dialog
{
   /// <summary>
   /// Interaction logic for SourceTableAddView.xaml
   /// </summary>
   public partial class DlgRefreshSource:HamburgerWizard
   {
      public override IHamburgerViewModel ViewModel => this.DataContext as IHamburgerViewModel;
      public override HamburgerMenu HamburgerMenuControlProp => this.HamburgerMenuControl;
      public override Button ButtonPrevProp => this.ButtonBack;
      public override Button ButtonNextProp => this.ButtonNext;
      public override Button ButtonOK => this.OKButton;

      public new ContentControl Owner
      {
         get => base.Owner;
         set => base.Owner = value as Window;
      }

      public DlgRefreshSource()
      {
         this.InitializeComponent();
         DialogServiceViews.SetIsRegistered(this ,true);
      }


      private void ButtonDb_Checked(object sender ,RoutedEventArgs e)
      {
         if (this.ButtonTable != null)
         {
            this.ButtonTable.IsChecked = false;
            this.DataGrid.IsEnabled = false;
            this.DataGrid.SelectedItem = null;
         }
      }

      private void ButtonTable_Checked(object sender ,RoutedEventArgs e)
      {
         if (this.ButtonDb != null)
         {
            this.ButtonDb.IsChecked = false;
            this.DataGrid.IsEnabled = true;
         }
      }
   }
}

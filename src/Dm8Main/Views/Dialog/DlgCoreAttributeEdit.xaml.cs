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
using System.ComponentModel;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Navigation;
using Dm8Main.Base;
using Dm8Main.ViewModels;
using Dm8Main.ViewModels.Dialog;
using MahApps.Metro.Controls;
using MvvmDialogs;
using MenuItem = Dm8Main.ViewModels.MenuItem;

namespace Dm8Main.Views.Dialog
{
    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class DlgCoreAttributeEdit : MetroWindow, IClosableWindow
    {
        public new ContentControl Owner
        {
            get => base.Owner;
            set => base.Owner = value as Window;
        }

        public DlgCoreAttributeEditViewModel ViewModel => (this.DataContext as DlgCoreAttributeEditViewModel)!;

        public DlgCoreAttributeEdit()
        {
            this.InitializeComponent();
            DialogServiceViews.SetIsRegistered(this, true);
            this.RestoreState(Properties.Settings.Default.DlgCoreAttributeEditSettings);
        }


        private void DlgCoreEntityAdd_OnLoaded(object sender, RoutedEventArgs e)
        {
            this.ViewModel.PropertyChanged += ViewModelOnPropertyChanged;
        }

        private void DlgCoreEntityAdd_OnClosing(object? sender, CancelEventArgs e)
        {
            Properties.Settings.Default.DlgCoreAttributeEditSettings = this.StoreState();
            Properties.Settings.Default.Save();
        }

        private void ViewModelOnPropertyChanged(object? sender, PropertyChangedEventArgs e)
        {

        }


    }
}
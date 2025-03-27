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
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using Dm8Main.Base;
using Dm8Main.ViewModels;
using Dm8Main.ViewModels.Dialog;
using MahApps.Metro.Controls;
using MvvmDialogs;

namespace Dm8Main.Views.Dialog
{
    /// <summary>
    /// Interaction logic for SourceTableAddView.xaml
    /// </summary>
    public partial class DlgRawModelEntryAdd : HamburgerWizard
    {
        public override IHamburgerViewModel ViewModel => this.DataContext as IHamburgerViewModel;
        public override HamburgerMenu HamburgerMenuControlProp => this.HamburgerMenuControl;
        public override Button ButtonPrevProp => this.ButtonBack;
        public override Button ButtonNextProp => this.ButtonNext;

        public override Button ButtonOK => this.OKButton;

        public DlgRawModelEntryAdd()
        {
            this.InitializeComponent();
            DialogServiceViews.SetIsRegistered(this, true);

        }

        private void ButtonSql_Checked(object sender, RoutedEventArgs e)
        {
            if (this.ButtonExplore != null)
                this.ButtonExplore.IsChecked = false;
        }

        private void ButtonExplore_Checked(object sender, RoutedEventArgs e)
        {
            if (this.ButtonSql != null)
                this.ButtonSql.IsChecked = false;
        }

        private void SelectAll_OnClick(object sender, RoutedEventArgs e)
        {
            CheckBox c = sender as CheckBox;

            if (c != null)
            {
                bool set = (bool)c.IsChecked;
                DlgRawModelEntryAddViewModel dm = ((DlgRawModelEntryAddViewModel)this.DataContext);

                var list = dm.Entities;
                foreach (var item in list)
                {
                    item.IsChecked = set;
                }

                dm.IsNextEnabled = set;
                dm.NumSelectablePages = set ? 2 : 1;

                var dg = DataGridEntities;
                dg.Items.Refresh();
                dg.SelectedItem = dg.Items[0];
            }
        }
    }
}

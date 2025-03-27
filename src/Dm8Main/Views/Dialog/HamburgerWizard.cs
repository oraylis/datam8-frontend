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
using Dm8Main.Base;
using Dm8Main.ViewModels.Dialog;
using MahApps.Metro.Controls;

namespace Dm8Main.Views.Dialog;

public abstract class HamburgerWizard : MetroWindow, IClosableWindow
{
    public abstract IHamburgerViewModel ViewModel { get;  }

    public abstract HamburgerMenu HamburgerMenuControlProp { get; }

    public abstract Button ButtonPrevProp { get; }

    public abstract Button ButtonNextProp { get; }
    public abstract Button ButtonOK { get; }

    public new ContentControl Owner
    {
        get => base.Owner;
        set => base.Owner = value as Window;
    }

    public HamburgerWizard()
    {
        this.Name = "Self";
        this.Activated += OnActivated;
    }

    private void OnActivated(object? sender, EventArgs e)
    {
        this.ViewModel.PropertyChanged += ViewModelOnPropertyChanged;
    }

    protected void ViewModelOnPropertyChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName == nameof(DlgCoreEntityEditRelationshipViewModel.NumSelectablePages))
        {
            this.EnableButtons();
        }
    }

    protected void HamburgerMenuControl_OnItemInvoked(object sender, HamburgerMenuItemInvokedEventArgs e)
    {
        if (e.InvokedItem is HamburgerMenuItem menuItem && menuItem.Tag is Grid)
        {
            this.HamburgerMenuControlProp.Content = menuItem.Tag as Grid;
            this.EnableButtons();
        }
    }

    private void EnableButtons()
    {
        for (int i = 0; i<this.ViewModel.NumSelectablePages && i< this.HamburgerMenuControlProp.Items.Count; i++)
        {
            (this.HamburgerMenuControlProp.Items.GetItemAt(i) as HamburgerMenuItem).IsEnabled = true;
        }

        for (int i = this.ViewModel.NumSelectablePages; i < this.HamburgerMenuControlProp.Items.Count; i++)
        {
            (this.HamburgerMenuControlProp.Items.GetItemAt(i) as HamburgerMenuItem).IsEnabled = false;
        }

        this.GetPrevNextItem(out HamburgerMenuItem prevItem, out HamburgerMenuItem nextItem);
        if (prevItem == null)
        {
            this.ButtonPrevProp.IsEnabled = false;
        }
        else
        {
            this.ButtonPrevProp.IsEnabled = true;
        }
    }

    private void GetPrevNextItem(out HamburgerMenuItem? prevItem, out HamburgerMenuItem? nextItem)
    {
        bool foundSelected = false;
        prevItem = null;
        nextItem = null;


        foreach (var i in Enumerable.OfType<HamburgerMenuItem>(this.HamburgerMenuControlProp.Items))
        {
            if (foundSelected)
            {
                nextItem = i;
                break;
            }

            if (i == this.HamburgerMenuControlProp.SelectedItem)
            {
                foundSelected = true;
            }
            else
            {
                i.IsEnabled = true;
                prevItem = i;
            }
        }
        if (nextItem == null)
        {
            this.ButtonNextProp.Visibility = Visibility.Hidden;
            this.ButtonNextProp.Width = 0;
            this.ButtonOK.Visibility = Visibility.Visible;
            this.ButtonOK.Width = 80;
        }
        else
        {
            this.ButtonNextProp.Visibility = Visibility.Visible;
            this.ButtonNextProp.Width = 80;
            this.ButtonOK.Visibility = Visibility.Hidden;
            this.ButtonOK.Width = 0;
        }
    }

    protected void ButtonPrev_Click(object sender, RoutedEventArgs e)
    {
        this.GetPrevNextItem(out HamburgerMenuItem prevItem, out HamburgerMenuItem nextItem);
        if (prevItem != null)
            this.HamburgerMenuControlProp.SelectedItem = prevItem;
    }

    protected void ButtonNext_Click(object sender, RoutedEventArgs e)
    {
        this.GetPrevNextItem(out HamburgerMenuItem prevItem, out HamburgerMenuItem nextItem);
        if (nextItem != null)
            this.HamburgerMenuControlProp.SelectedItem = nextItem;
    }

}
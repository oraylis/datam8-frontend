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
using System.Windows;
using MahApps.Metro.Controls;

namespace Dm8Main.ViewModels
{
   public class MenuItem:HamburgerMenuIconItem
   {
      /// <summary>Identifies the <see cref="NavigationDestination"/> dependency property.</summary>
      public static readonly DependencyProperty NavigationDestinationProperty
          = DependencyProperty.Register(
              nameof(NavigationDestination) ,
              typeof(Uri) ,
              typeof(MenuItem) ,
              new PropertyMetadata(default(Uri)));

      public Uri NavigationDestination
      {
         get => (Uri)this.GetValue(NavigationDestinationProperty);
         set => this.SetValue(NavigationDestinationProperty ,value);
      }

      /// <summary>Identifies the <see cref="NavigationType"/> dependency property.</summary>
      public static readonly DependencyProperty NavigationTypeProperty
          = DependencyProperty.Register(
              nameof(NavigationType) ,
              typeof(Type) ,
              typeof(MenuItem) ,
              new PropertyMetadata(default(Type)));

      public Type NavigationType
      {
         get => (Type)this.GetValue(NavigationTypeProperty);
         set => this.SetValue(NavigationTypeProperty ,value);
      }

      public bool IsNavigation => this.NavigationDestination != null;
   }
}
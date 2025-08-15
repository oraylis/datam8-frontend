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
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Linq;
using Attribute = Dm8Data.Core.Attribute;

namespace Dm8Main.Models;

public class EditRelationshipAttribute:Prism.Mvvm.BindableBase
{
   public EditRelationshipAttribute()
   {
      this.PropertyChanged += OnPropertyChanged;
   }

   private void OnPropertyChanged(object? sender ,PropertyChangedEventArgs e)
   {
      switch (e.PropertyName)
      {
         case nameof(this.Filter):
            this.FilterAttributes = new ObservableCollection<Attribute>(this.Attributes.Where(a => a.Name.Contains(this.Filter ?? string.Empty
                ,StringComparison.InvariantCultureIgnoreCase)));
            break;
      }
   }

   #region Property KeyAttribute
   public Dm8Data.Core.Attribute KeyAttribute
   {
      get => this.keyAttribute;
      set => this.SetProperty(ref this.keyAttribute ,value);
   }

   private Dm8Data.Core.Attribute keyAttribute;
   #endregion

   #region Property Filter
   public string Filter
   {
      get => this.filter;
      set => this.SetProperty(ref this.filter ,value);
   }

   private string filter;
   #endregion

   #region Property FilterAttributes
   public ObservableCollection<Attribute> FilterAttributes
   {
      get => this.filterAttributes;
      set => this.SetProperty(ref this.filterAttributes ,value);
   }

   private ObservableCollection<Attribute> filterAttributes;
   #endregion

   #region Property SelectedAttribute
   public Dm8Data.Core.Attribute SelectedAttribute
   {
      get => this.selectedAttribute;
      set => this.SetProperty(ref this.selectedAttribute ,value);
   }

   private Dm8Data.Core.Attribute selectedAttribute;
   #endregion

   #region Property Attributes
   public ObservableCollection<Attribute> Attributes
   {
      get => this.attributes;
      set => this.SetProperty(ref this.attributes ,value);
   }

   private ObservableCollection<Attribute> attributes;
   #endregion

   #region Property OrderNr
   public int OrderNr
   {
      get => this.orderNr;
      set => this.SetProperty(ref this.orderNr ,value);
   }

   private int orderNr;
   #endregion
}
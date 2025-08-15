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
using System.Collections.Specialized;
using System.Linq;

namespace Dm8Data.Stage
{
   public partial class Attribute:Prism.Mvvm.BindableBase
   {
      public void CallProperyChanged(string propertyName)
      {
         this.RaisePropertyChanged(propertyName);
      }
   }

   public partial class StageEntity:Prism.Mvvm.BindableBase
   {
      public static readonly string SOURCE_ENTITY_LOCATOR = "DataProduct/DataModule/Name";

      public static readonly string[] resourceProperties = SOURCE_ENTITY_LOCATOR.Split('/');

      public StageEntity()
      {
         this.PropertyChanged += this.SourceEntity_PropertyChanged;
         this.Attribute = new ObservableCollection<Attribute>();
         this.Attribute.CollectionChanged += AttributeOnCollectionChanged;
         this.Tags = new ObservableCollection<string>();
         this.Parameters = new ObservableCollection<Parameter>();

      }

      private void AttributeOnCollectionChanged(object sender ,NotifyCollectionChangedEventArgs e)
      {
         if (e.NewItems != null)
         {
            foreach (var a in e.NewItems.OfType<Attribute>())
            {
               if (a.Tags == null)
               {
                  a.Tags = new ObservableCollection<string>();
               }

               a.Tags.CollectionChanged += (s ,e) => TagsOnCollectionChanged(a ,s ,e);
            }
         }
      }

      private void TagsOnCollectionChanged(Attribute attr ,object sender ,NotifyCollectionChangedEventArgs e)
      {
         attr.CallProperyChanged(nameof(attr.Tags));
      }

      private void SourceEntity_PropertyChanged(object sender ,System.ComponentModel.PropertyChangedEventArgs e)
      {
         if (resourceProperties.Contains(e.PropertyName))
         {
            this.RaisePropertyChanged(nameof(this.Dm8l));
         }
      }

      [Newtonsoft.Json.JsonIgnore]
      public string Dm8l
      {
         get
         {
            return $"/{Properties.Resources.Layer_Stage}/{this.DataProduct}/{this.DataModule}/{this.Name}";
         }
      }
   }
}

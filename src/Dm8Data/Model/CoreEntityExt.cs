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
using System.ComponentModel;
using System.Linq;
using Dm8Data.Helper;
using Newtonsoft.Json;

namespace Dm8Data.Core
{
   public partial class Attribute:Prism.Mvvm.BindableBase
   {
      public void CallProperyChanged(string propertyName)
      {
         this.RaisePropertyChanged(propertyName);
      }
   }

   public partial class Relationship:Prism.Mvvm.BindableBase
   {
      public Relationship()
      {
         this.Fields = new ObservableCollection<RelationshipField>();
         this.Fields.CollectionChanged += this.FieldsOnCollectionChanged;
      }

      [JsonIgnoreAttribute]
      public string FieldInfo
      {
         get
         {
            return this.Fields.Select(f => f.Dm8lAttr).ToCommaList();
         }
      }

      private void FieldsOnCollectionChanged(object sender ,NotifyCollectionChangedEventArgs e)
      {
         this.RaisePropertyChanged(nameof(this.FieldInfo));
      }

   }

   public partial class CoreEntity:Prism.Mvvm.BindableBase
   {
      public static readonly string CoreEntityLocator = "DataProduct/DataModule/Name";

      public static readonly string[] ResourceProperties = CoreEntityLocator.Split('/');

      [JsonIgnoreAttribute]
      public string Layer
      {
         get => this.layer;
         set
         {
            if (this.layer == null)
            {
               this.layer = value;
            }
         }
      }

      private string layer;

      public CoreEntity()
      {
         this.PropertyChanged += this.CoreEntity_PropertyChanged;
         this.Attribute = new ObservableCollection<Attribute>();
         this.Attribute.CollectionChanged += AttributeOnCollectionChanged;
         this.Relationship = new ObservableCollection<Relationship>();
         this.Tags = new ObservableCollection<string>();
         this.Parameters = new ObservableCollection<Parameter>();
         this.RefactorNames = new ObservableCollection<string>();
      }

      private void AttributeOnCollectionChanged(object sender ,NotifyCollectionChangedEventArgs e)
      {
         if (e.NewItems != null)
         {
            foreach (var a in e.NewItems.OfType<Attribute>())
            {
               if (a.Tags == null)
                  a.Tags = new ObservableCollection<string>();
               a.Tags.CollectionChanged += (s ,e) => TagsOnCollectionChanged(a ,s ,e);
               a.PropertyChanged += AttrPropertyChanged;
            }
         }
      }

      private void AttrPropertyChanged(object sender ,PropertyChangedEventArgs e)
      {
         if (sender is Attribute attr)
         {
            if (attr.RefactorNames == null)
               attr.RefactorNames = new ObservableCollection<string>();
         }
         this.CallProperyChanged(nameof(this.Attribute));
      }

      private void TagsOnCollectionChanged(Attribute attr ,object sender ,NotifyCollectionChangedEventArgs e)
      {
         attr.CallProperyChanged(nameof(attr.Tags));
      }


      private void CoreEntity_PropertyChanged(object sender ,System.ComponentModel.PropertyChangedEventArgs e)
      {
         if (ResourceProperties.Contains(e.PropertyName))
         {
            this.RaisePropertyChanged(nameof(this.Dm8l));
         }
      }

      public void CallProperyChanged(string propertyName)
      {
         this.RaisePropertyChanged(propertyName);
      }

      [Newtonsoft.Json.JsonIgnore]
      public string Dm8l => $"/{this.Layer}/{this.DataProduct}/{this.DataModule}/{this.Name}";
   }

   public partial class CoreFunction:Prism.Mvvm.BindableBase
   {
      public CoreFunction()
      {
         this.Source = new ObservableCollection<SourceEntity>();
      }
   }

   public partial class SourceEntity:Prism.Mvvm.BindableBase
   {
      public SourceEntity()
      {
         this.Mapping = new ObservableCollection<Mapping>();
      }
   }

   public partial class ModelEntry:Prism.Mvvm.BindableBase, ICoreModel
   {
      public ModelEntry()
      {
         this.Entity = new CoreEntity() { Layer = Properties.Resources.Layer_Core };
         this.Function = new CoreFunction();
         this.PropertyChanged += ModelEntry_PropertyChanged;
      }

      private void ModelEntry_PropertyChanged(object sender ,PropertyChangedEventArgs e)
      {
         if (e.PropertyName == nameof(Entity))
         {
            this.Entity.Layer = Properties.Resources.Layer_Core;
         }
      }
   }
}

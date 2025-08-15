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

using System.Collections;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using Dm8Data.Base;
using Dm8Data.Generic;

namespace Dm8Data.DataProducts
{
   public partial class DataProducts:Prism.Mvvm.BindableBase, IModelEntryList<DataProduct>
   {
      public DataProducts()
      {
         this.Items = new ObservableCollection<DataProduct>();
      }

      public ObservableCollection<DataProduct> Values => this.Items as ObservableCollection<DataProduct>;

      IEnumerable IModelEntryList.Values => this.Items;
   }

   public partial class DataModule:Prism.Mvvm.BindableBase
   {
      public void CallProperyChanged(string propertyName)
      {
         this.RaisePropertyChanged(propertyName);
      }
   }

   public partial class DataProduct:Prism.Mvvm.BindableBase
   {

      public DataProduct()
      {
         this.PropertyChanged += this.DataProduct_PropertyChanged;
         this.Module = new ObservableCollection<DataModule>();
         this.Module.CollectionChanged += ModuleOnCollectionChanged;
      }

      private void DataProduct_PropertyChanged(object sender ,System.ComponentModel.PropertyChangedEventArgs e)
      {

      }

      private void ModuleOnCollectionChanged(object sender ,NotifyCollectionChangedEventArgs e)
      {
      }
   }

}
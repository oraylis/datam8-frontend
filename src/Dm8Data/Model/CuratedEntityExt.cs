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

namespace Dm8Data.Curated
{


   public partial class CuratedFunction:Prism.Mvvm.BindableBase
   {
      public CuratedFunction()
      {
         this.Source = new ObservableCollection<Dm8Data.Curated.ComputationSourceEntity>();
      }
   }


   public partial class ModelEntry:Prism.Mvvm.BindableBase, ICoreModel
   {
      public ModelEntry()
      {
         this.Entity = new Dm8Data.Core.CoreEntity() { Layer = Properties.Resources.Layer_Curated };
         this.Function = new ObservableCollection<CuratedFunction>();
         this.PropertyChanged += ModelEntry_PropertyChanged;
      }

      private void ModelEntry_PropertyChanged(object sender ,PropertyChangedEventArgs e)
      {
         if (e.PropertyName == nameof(Entity))
         {
            this.Entity.Layer = Properties.Resources.Layer_Curated;
         }
      }
   }
}

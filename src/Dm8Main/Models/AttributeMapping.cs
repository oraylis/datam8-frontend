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
using System.Linq;
using System.Text;


namespace Dm8Main.Models;

public class AttributeMapping:Prism.Mvvm.BindableBase
{
   #region Property IsChecked
   public bool IsChecked
   {
      get => this.isChecked;
      set => this.SetProperty(ref this.isChecked ,value);
   }

   private bool isChecked;
   #endregion

   #region Property Attribute
   public Dm8Data.Core.Attribute Attribute
   {
      get => this.attribute;
      set => this.SetProperty(ref this.attribute ,value);
   }

   private Dm8Data.Core.Attribute attribute;
   #endregion

   #region Property MappingInfo
   public string MappingInfo
   {
      get
      {
         StringBuilder sb = new StringBuilder();
         string defaultMap = "";
         foreach (var mappingEntry in this.mappingEntries)
         {
            if (mappingEntry.StageEntity.Name == "#")
            {
               defaultMap = "[" + mappingEntry.SourceComputation + "]";
            }
            else
            {
               if (sb.Length > 0)
               {
                  sb.Append("; ");
               }

               sb.Append(mappingEntry.SourceComputation ?? mappingEntry.SourceName);
            }
         }
         return sb.ToString() + (sb.Length > 0 ? "; " : "") + defaultMap;
      }
   }
   #endregion

   #region Property Compute
   public string Compute
   {
      set => this.SetProperty(ref this.compute ,value);
      get
      {
         if (this.compute == null)
         {
            var cme = this.MappingEntries.FirstOrDefault(me => me.StageEntity.Name == "#");
            this.compute = cme != null ? cme.SourceComputation : string.Empty;
         }
         return this.compute;
      }
   }

   private string compute;
   #endregion

   #region Property Sources
   public string Sources
   {
      get
      {
         StringBuilder sb = new StringBuilder();
         StringBuilder sbHash = new StringBuilder();
         foreach (var mappingEntry in this.mappingEntries)
         {
            if (mappingEntry.StageEntity.Name != "#")
            {
               if (sbHash.ToString().Contains("#" + mappingEntry.StageEntity.Dm8l + "#"))
               {
                  continue;
               }

               if (sb.Length > 0)
               {
                  sb.Append("; ");
               }

               sb.Append(mappingEntry.StageEntity.Dm8l);
               sbHash.Append("#" + mappingEntry.StageEntity.Dm8l + "#");
            }
         }
         return sb.ToString();
      }
   }
   #endregion

   #region Property MappingEntries
   public ObservableCollection<MappingEntry> MappingEntries
   {
      get => this.mappingEntries;
      set => this.SetProperty(ref this.mappingEntries ,value);
   }

   private ObservableCollection<MappingEntry> mappingEntries;
   #endregion

   public void InfoPropertiesChanged()
   {
      this.OnPropertyChanged(new PropertyChangedEventArgs(nameof(this.Compute)));
      this.OnPropertyChanged(new PropertyChangedEventArgs(nameof(this.MappingInfo)));
      this.OnPropertyChanged(new PropertyChangedEventArgs(nameof(this.Sources)));
   }
}
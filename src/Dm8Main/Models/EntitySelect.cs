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

using Dm8Main.Models;

namespace Dm8Main.ViewModels
{
   public class EntitySelect:Prism.Mvvm.BindableBase
   {
      #region Property IsSelected
      public bool IsSelected
      {
         get => this.isSelected;
         set => this.SetProperty(ref this.isSelected ,value);
      }

      public bool isSelected;
      #endregion

      #region Property ItemType
      public ProjectItem.Types ItemType
      {
         get => this.itemType;
         set => this.SetProperty(ref this.itemType ,value);
      }

      public ProjectItem.Types itemType;
      #endregion

      #region Property Name
      public string Name
      {
         get => this.name;
         set => this.SetProperty(ref this.name ,value);
      }

      public string name;
      #endregion

      #region Property RelativePath
      public string RelativePath
      {
         get => this.relativePath;
         set => this.SetProperty(ref this.relativePath ,value);
      }

      public string relativePath;
      #endregion

      #region Property FilePath
      public string FilePath
      {
         get => this.filePath;
         set => this.SetProperty(ref this.filePath ,value);
      }

      public string filePath;
      #endregion
   }
}

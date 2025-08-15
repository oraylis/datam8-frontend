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
using System.Composition;

namespace Dm8Main.ViewModels
{
   [Export]
   public class ViewModelBase:Prism.Mvvm.BindableBase, IDisposable
   {
      #region Property Title
      public string Title
      {
         get => this.title;
         set => this.SetProperty(ref this.title ,value);
      }

      private string title;
      #endregion

      #region Property ContentId
      public string ContentId
      {
         get => this.contentId;
         set => this.SetProperty(ref this.contentId ,value);
      }

      private string contentId;
      #endregion

      #region Property IsSelected
      public bool IsSelected
      {
         get => this.isSelected;
         set => this.SetProperty(ref this.isSelected ,value);
      }

      private bool isSelected;
      #endregion

      #region Property IsModified
      public bool IsModified
      {
         get => this.isModified;
         set => this.SetProperty(ref this.isModified ,value);
      }

      private bool isModified;
      #endregion

      public ViewModelBase()
      {
         this.ContentId = "Type$" + this.GetType().Name;
      }

      public virtual void Dispose()
      {

      }
   }
}
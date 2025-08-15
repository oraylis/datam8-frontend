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

using System.ComponentModel;

namespace Dm8Main.Base
{
   public class CheckableContent<T>:Prism.Mvvm.BindableBase where T : Prism.Mvvm.BindableBase
   {
      public CheckableContent() => this.Content = null;

      public CheckableContent(T content) => this.Content = content;

      #region Property IsChecked
      public bool IsChecked
      {
         get => this.isChecked;
         set
         {
            if (this.isChecked != value)
            {
               this.isChecked = value;
               RaiseCheckableChanged();
            }
         }
      }
      private bool isChecked;

      #endregion

      #region Property Content

      public T Content
      {
         get => this.content;
         set
         {
            if (this.content != null)
            {
               this.content.PropertyChanged -= this.OnPropertyChanged;
            }

            this.SetProperty(ref this.content ,value);
            if (this.content != null)
            {
               this.content.PropertyChanged += this.OnPropertyChanged;
            }
         }
      }
      private T content;

      private void OnPropertyChanged(object? sender ,PropertyChangedEventArgs e)
      {
         this.RaisePropertyChanged(nameof(this.Content));
      }
      #endregion

      #region Checkable Changed
      private void RaiseCheckableChanged()
      {
         OnCheckableChanged(new PropertyChangedEventArgs("IsChecked"));
      }
      protected virtual void OnCheckableChanged(PropertyChangedEventArgs args)
      {
         CheckableChanged?.Invoke(this ,args);
      }
      public event PropertyChangedEventHandler CheckableChanged;
      #endregion
   }
}

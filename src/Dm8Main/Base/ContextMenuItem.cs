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

using System.Windows.Controls;
using Prism.Commands;

namespace Dm8Main.Base
{
   public class ContextMenuItem:Prism.Mvvm.BindableBase
   {
      #region Property Icon
      public Control Icon
      {
         get => this.icon;
         set => this.SetProperty(ref this.icon ,value);
      }

      private Control icon;
      #endregion

      #region Property Header
      public string Header
      {
         get => this.header;
         set => this.SetProperty(ref this.header ,value);
      }

      private string header;
      #endregion

      #region Property InputGestureText
      public string InputGestureText
      {
         get => this.inputGestureText;
         set => this.SetProperty(ref this.inputGestureText ,value);
      }

      private string inputGestureText;
      #endregion

      #region Property Command
      public DelegateCommand Command
      {
         get => this.command;
         set => this.SetProperty(ref this.command ,value);
      }

      private DelegateCommand command;
      #endregion
   }
}
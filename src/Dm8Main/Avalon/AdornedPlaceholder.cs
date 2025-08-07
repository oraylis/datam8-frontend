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

using System.Windows;
using System.Windows.Documents;
using System.Windows.Media;

namespace Dm8Main.Avalon
{
   public class AdornedPlaceholder:FrameworkElement
   {
      public Adorner Adorner
      {
         get
         {
            Visual current = this;
            while (current != null && !(current is Adorner))
            {
               current = (Visual)VisualTreeHelper.GetParent(current);
            }

            return (Adorner)current;
         }
      }

      public FrameworkElement AdornedElement => this.Adorner == null ? null : this.Adorner.AdornedElement as FrameworkElement;

      protected override Size MeasureOverride(Size availableSize)
      {
         if (this.Adorner is ControlAdorner controlAdorner)
         {
            controlAdorner.Placeholder = this;
         }

         FrameworkElement e = this.AdornedElement;
         return new Size(e.ActualWidth ,e.ActualHeight);
      }
   }

}

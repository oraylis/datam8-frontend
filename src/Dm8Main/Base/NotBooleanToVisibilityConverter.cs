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
using System.Globalization;
using System.Windows;
using System.Windows.Data;

namespace Dm8Main.Base
{
   //
   // Summary:
   //     Represents the converter that converts Boolean values to and from System.Windows.Visibility
   //     enumeration values.
   [Localizability(LocalizationCategory.NeverLocalize)]
   public sealed class NotBooleanToVisibilityConverter:IValueConverter
   {
      //
      // Summary:
      //     Initializes a new instance of the System.Windows.Controls.BooleanToVisibilityConverter
      //     class.
      public NotBooleanToVisibilityConverter()
      {
      }

      //
      // Summary:
      //     Converts a Boolean value to a System.Windows.Visibility enumeration value.
      //
      // Parameters:
      //   value:
      //     The Boolean value to convert. This value can be a standard Boolean value or a
      //     nullable Boolean value.
      //
      //   targetType:
      //     This parameter is not used.
      //
      //   parameter:
      //     This parameter is not used.
      //
      //   culture:
      //     This parameter is not used.
      //
      // Returns:
      //     System.Windows.Visibility.Visible if value is true; otherwise, System.Windows.Visibility.Collapsed.
      public object Convert(object value ,Type targetType ,object parameter ,CultureInfo culture)
      {
         if (value is bool visibleBool)
         {
            return !visibleBool ? Visibility.Visible : Visibility.Collapsed;
         }
         else
         {
            return Visibility.Collapsed;
         }
      }


      //
      // Summary:
      //     Converts a System.Windows.Visibility enumeration value to a Boolean value.
      //
      // Parameters:
      //   value:
      //     A System.Windows.Visibility enumeration value.
      //
      //   targetType:
      //     This parameter is not used.
      //
      //   parameter:
      //     This parameter is not used.
      //
      //   culture:
      //     This parameter is not used.
      //
      // Returns:
      //     true if value is System.Windows.Visibility.Visible; otherwise, false.
      public object ConvertBack(object value ,Type targetType ,object parameter ,CultureInfo culture)
      {
         throw new NotImplementedException();
      }
   }
}

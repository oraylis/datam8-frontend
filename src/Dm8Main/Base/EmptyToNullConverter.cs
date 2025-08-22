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
using System.Windows.Data;

namespace Dm8Main.Base
{
   public class EmptyToNullConverter:IValueConverter
   {
      public object Convert(object value ,Type targetType ,object parameter ,CultureInfo culture)
      {
         if (value == null)
         {
            return null;
         }

         return string.IsNullOrEmpty(value.ToString()) ? null : value;
      }

      public object ConvertBack(object value ,Type targetType ,object parameter ,CultureInfo culture)
      {
         if (value is String s)
         {
            if (string.IsNullOrEmpty(s))
            {
               return null;
            }
            else
            {
               if (int.TryParse(value.ToString() ,out int v))
               {
                  return v;
               }
               else
               {
                  return null;
               }
            }
         }

         return value;
      }
   }
}

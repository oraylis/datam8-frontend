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

using System.IO;

namespace Dm8Data.Helper
{
   public class PathHelper
   {
      public static string Combine(string path1 ,string path2)
      {
         string retVal = "";

         while (path1.EndsWith(@"\"))
         {
            path1 = path1.Substring(0 ,path1.Length - 1);
         }
         while (path2.StartsWith(@"\"))
         {
            path2 = path2.Substring(1);
         }

         retVal = Path.Combine(path1 ,path2);

         return (retVal);
      }
   }
}

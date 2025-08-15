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

namespace Dm8Locator.Db
{
   public enum Dm8DataLocatorColumnDataType
   /// <summary>
   /// Enum of internal data types
   /// </summary>
   {
      NONE = 0,
      Null = 1,
      Bool = 2,

      // integers
      Int8 = 10,
      Int16 = 11,
      Int32 = 12,
      Int64 = 13,

      // strings
      Utf8 = 20,
      Utf16 = 21,
      Utf32 = 22,

      // Floating and Decimal
      Double = 30,
      Float = 31,
      Decimal = 32,
      Numeric = 33,

      // date time
      Date = 40,
      Time = 41,
      Timestamp = 42,

      // binary
      Binary = 50
   }

}

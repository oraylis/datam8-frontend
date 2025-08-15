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

namespace Dm8Data.Validate.Exceptions
{
   public class NotNullExpressionException:ModelReaderException
   {
      public const string MessageFormat = "Value not specified for '{0}'";

      public NotNullExpressionException()
      {
         this.Code = "F002";
      }

      public override string Message
      {
         get
         {
            return string.Format(MessageFormat ,this.Field);
         }
      }

      public override string Source
      {
         get
         {
            return $"Not Null Error: '{this.Field}'";
         }
      }

      public string Field { get; set; }


   }
}

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

using System.Collections;
using System.Collections.Generic;
using Dm8Data.Helper;

namespace Dm8Data.Validate.Exceptions
{
   public class UniqueExpressionException:ModelReaderException
   {
      public const string MessageFormat0 = "Unique error without field information";

      public const string MessageFormat1 = "Value not unique '{0}'";

      public const string MessageFormat2 = "Value combination not unique '{0}'";

      public UniqueExpressionException()
      {
         this.Code = "F001";
      }

      public override string Message
      {
         get
         {
            if (this.FieldList.Count == 1)
            {
               return string.Format(MessageFormat1 ,this.ValueList.ToCommaList());
            } else if (this.FieldList.Count > 1)
            {
               return string.Format(MessageFormat2 ,this.ValueList.ToCommaList());
            } else
            {
               return MessageFormat0;
            }
         }
      }

      public override string Source
      {
         get
         {
            return $"Unique Error: '{this.FieldList.ToCommaList()}'";
         }
      }

      public List<string> FieldList { get; set; }

      public List<string> ValueList { get; set; }

      public ICollection ObjectList { get; set; }

   }
}

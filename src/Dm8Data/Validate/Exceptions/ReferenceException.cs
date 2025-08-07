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
using System.Collections.Generic;
using System.Linq;
using Dm8Data.Helper;

namespace Dm8Data.Validate.Exceptions
{
   public class ReferenceException:ModelReaderException
   {
      public const string MessageFormat0 = "Reference error without field information";

      public const string MessageFormat1 = "Reference '{0}' not found for attribute '{1}'";

      public const string MessageFormat2 = "References '{0}' not found for attribute '{1}'";

      public ReferenceException()
      {
         this.Code = "R001";
      }

      public override string Message
      {
         get
         {
            if (this.ValueList.Count == 1)
            {
               return string.Format(MessageFormat1 ,this.ValueList.ToCommaList() ,this.FieldNames.Select(i => i.Item1).ToCommaList());
            }

            if (this.ValueList.Count > 1)
            {
               return string.Format(MessageFormat2 ,this.ValueList.ToCommaList() ,this.FieldNames.Select(i => i.Item1).ToCommaList());
            } else
            {
               return MessageFormat0;
            }
         }
      }

      public override string Source
      {
         get => $"Reference Error: {this.SourceObject} ({this.FieldNames.Select(i => i.Item1).ToCommaList()}) to {this.TargetObject} ({this.FieldNames.Select(i => i.Item2).ToCommaList()}) ";
      }


      public string SourceObject { get; set; }

      public string TargetObject { get; set; }

      public List<Tuple<string ,string>> FieldNames { get; set; }

      public List<string> ValueList { get; set; }


   }
}

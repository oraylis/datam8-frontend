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
   public class SchemaValidateException:ModelReaderException
   {
      private readonly int line;
      private readonly int pos;

      public const string MessageFormat0 = "Line: {0} Pos: {1}";

      public SchemaValidateException(string message ,int lineNo ,int pos ,string filePath)
      : base(message)
      {
         this.pos = pos;
         this.line = lineNo;
         this.FilePath = filePath;
      }

      public override string Message => base.Message;

      public override string Source => string.Format(MessageFormat0 ,this.line ,this.pos);
   }
}

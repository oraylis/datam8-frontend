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
   public class ForeignKeyException:ModelReaderException
   {
      public const string MessageFormat = "Foreign-Key field used in {0} does not exist in {1}: {2}";

      private readonly Core.RelationshipField relationshipField;

      private readonly string fieldName;

      private readonly Core.CoreEntity entity;

      public ForeignKeyException(Core.RelationshipField relationshipField ,Core.CoreEntity entity ,string fieldName)
      {
         this.Code = "F002";
         this.relationshipField = relationshipField;
         this.entity = entity;
         this.fieldName = fieldName;
      }

      public override string Message
      {
         get
         {
            return string.Format(MessageFormat ,this.relationshipField.Dm8lAttr ,this.entity.Dm8l ,this.fieldName);
         }
      }

      public override string Source
      {
         get => $"ForeignKey Error: {this.relationshipField.Dm8lAttr}";
      }

   }
}

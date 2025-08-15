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

using System.Linq;
using Dm8Data.Helper;
using Dm8Locator.Dm8l;

namespace Dm8Data.Validate.Exceptions
{
   public class ForeignKeysException:ModelReaderException
   {
      public const string MessageFormat = "Foreign-Key fields {0} [{1}] does not match with {2} [{3}]";


      private readonly Core.Relationship relationship;

      private readonly Core.CoreEntity foreignCoreEntity;

      private readonly Core.CoreEntity primaryCoreEntity;


      public ForeignKeysException(Core.Relationship relationship ,Core.CoreEntity foreignCoreEntity ,Core.CoreEntity primaryCoreEntity)
      {
         this.Code = "F001";
         this.relationship = relationship;
         this.foreignCoreEntity = foreignCoreEntity;
         this.primaryCoreEntity = primaryCoreEntity;
      }

      public override string Message
      {
         get
         {
            var primaryModelAttrs = primaryCoreEntity.Attribute
                .Where(attr => attr.BusinessKeyNo != null);

            return string.Format(MessageFormat ,foreignCoreEntity.Dm8l ,relationship.Fields.Select(f => new Dm8lAttribute(f.Dm8lAttr).Name).ToCommaList() ,primaryCoreEntity.Dm8l ,primaryModelAttrs.Select(attr => attr.Name).ToCommaList());
         }
      }

      public override string Source
      {
         get => $"ForeignKeys Error: {this.relationship.Dm8lKey} ({this.relationship.Role})";
      }


   }
}

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
using System.Threading.Tasks;
using Dm8Data.Validate.Exceptions;
using Dm8Locator.Dm8l;

namespace Dm8Data.Validate
{
   public class ValidateForeignKey
   {
      public static async Task<IEnumerable<ModelReaderException>> ValidateAsync(Core.ModelEntry foreignModelEntry ,Func<Dm8lEntity ,Task<Core.CoreEntity>> readerFunc)
      {
         return await Validate(foreignModelEntry.Entity ,readerFunc);
      }

      public static async Task<IEnumerable<ModelReaderException>> ValidateAsync(Curated.ModelEntry foreignModelEntry ,Func<Dm8lEntity ,Task<Core.CoreEntity>> readerFunc)
      {
         return await Validate(foreignModelEntry.Entity ,readerFunc);
      }

      private static async Task<IEnumerable<ModelReaderException>> Validate(Core.CoreEntity foreignEntity ,Func<Dm8lEntity ,Task<Core.CoreEntity>> readerFunc)
      {
         var rc = new List<ModelReaderException>();
         if (foreignEntity.Relationship == null)
         {
            return rc;
         }

         foreach (var relationship in foreignEntity.Relationship)
         {
            try
            {
               var primaryEntity = await readerFunc(new Dm8lEntity(relationship.Dm8lKey));
               var primaryAttrs = primaryEntity.Attribute
                   .Where(attr => attr.BusinessKeyNo != null).ToList();
               if (primaryAttrs.Count() != relationship.Fields.Count())
               {
                  rc.Add(new ForeignKeysException(relationship ,primaryEntity ,foreignEntity));
               }

               foreach (var relationshipField in relationship.Fields)
               {
                  if (relationshipField.Dm8lAttr == null)
                  {
                     rc.Add(new ForeignKeyException(relationshipField ,foreignEntity ,"(not defined)"));
                     continue;
                  }
                  var attr = new Dm8lAttribute(relationshipField.Dm8lAttr);
                  if (!foreignEntity.Attribute.Any(a => a.Name == attr.Name))
                  {
                     rc.Add(new ForeignKeyException(relationshipField ,foreignEntity ,attr.Name));
                  }

                  var attrKey = new Dm8lAttribute(relationshipField.Dm8lKeyAttr);
                  if (!primaryEntity.Attribute.Any(a => a.Name == attrKey.Name))
                  {
                     rc.Add(new ForeignKeyException(relationshipField ,primaryEntity ,attrKey.Name));
                  }
               }
            }
            catch (Exception ex)
            {
               rc.Add(new UnknownValidateException(ex ,"Unknown"));
            }
         }

         return rc;
      }

   }

}


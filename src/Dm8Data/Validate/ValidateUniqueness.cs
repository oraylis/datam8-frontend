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
using System.Linq.Expressions;
using System.Threading.Tasks;
using Dm8Data.Helper;
using Dm8Data.Validate.Exceptions;

namespace Dm8Data.Validate
{
   public class ValidateUniqueness<TObj>
   {
      struct Entry
      {
         public List<string> vals;
         public List<TObj> objs;
      };

      public static async Task<IEnumerable<ModelReaderException>> ValidateAsync(IEnumerable<TObj> list ,params Expression<Func<TObj ,string>>[] fieldGetter)
      {
         var rc = new List<ModelReaderException>();
         try
         {
            await Task.Factory.StartNew(() =>
            {
               var fieldGetterFunc = new List<Func<TObj ,string>>();
               foreach (var f in fieldGetter)
               {
                  fieldGetterFunc.Add(f.Compile());
               }

               var uniqueHash = new Dictionary<string ,Entry>();
               var uniqueError = new List<string>();
               foreach (var item in list)
               {
                  if (item == null)
                     continue;
                  var vals = new List<string>();
                  foreach (var f in fieldGetterFunc)
                  {
                     vals.Add(f(item));
                  }
                  var key = vals.ToSeparatorList("$");
                  if (uniqueHash.ContainsKey(key))
                  {
                     uniqueError.Add(key);
                     uniqueHash[key].objs.Add(item);
                  } else
                  {
                     var objs = new List<TObj>
                        {
                                item
                        };

                     uniqueHash.Add(key ,new Entry { vals = vals ,objs = objs });
                  }
               }

               var names = fieldGetter.Select(f => ValidateHelper.GetPropertyName(f)).ToList();

               foreach (var e in uniqueError)
               {
                  rc.Add(new UniqueExpressionException { FieldList = names ,ValueList = uniqueHash[e].vals ,ObjectList = uniqueHash[e].objs });
               }

            });
         } catch (Exception ex)
         {
            rc.Add(new UnknownValidateException(ex ,"Unknown"));
         }
         return rc;
      }
   }
}

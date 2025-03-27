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
using System.Collections.ObjectModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Dm8Data.Helper
{
    public static class ObservableCollectionExt
    {
        public static void Update<Type>(this ObservableCollection<Type> This, IEnumerable<Type> Other, Func<Type, string> identifier)
        {

            // is changed or removed
            var dictOther = Other.Where(i => identifier(i) != null).ToDictionary(i => identifier(i));
            var toRemove = new List<Type>();
            for (int i=0; i<This.Count; i++)
            {
                if (identifier(This[i]) == null)
                    continue;

                // contains object -> update
                if (dictOther.TryGetValue(identifier(This[i]), out Type newObj))
                {
                    Copy(This[i], newObj);
                }
                else
                {
                    toRemove.Add(This[i]);
                }
            }

            // remove item
            foreach (var item in toRemove)
            {
                This.Remove(item);
            }

            // find new item added
            var dictThis = This.ToDictionary(i => identifier(i));
            foreach (var item in Other)
            {
                // contains object
                if (dictThis.ContainsKey(identifier(item)))
                    continue;

                if (identifier(item) == null)
                    continue;

                This.Add(item);
            }
        }

        public static void Copy<Type>(Type parent, Type child)
        {
            var parentProperties = parent.GetType().GetProperties();
            var childProperties = child.GetType().GetProperties();

            foreach (var parentProperty in parentProperties)
            {
                foreach (var childProperty in childProperties)
                {
                    if (parentProperty.Name == childProperty.Name && parentProperty.PropertyType == childProperty.PropertyType)
                    {
                        childProperty.SetValue(child, parentProperty.GetValue(parent));
                        break;
                    }
                }
            }
        }
    }

}

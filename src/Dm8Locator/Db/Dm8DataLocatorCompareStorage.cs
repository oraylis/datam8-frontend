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
   public class Dm8DataLocatorCompareStorage
   {
      /// <summary>
      /// Internal result storage (left, right)
      /// </summary>
      internal readonly Dm8LocatorDictionary<Dm8DataLocatorPair> result = new Dm8LocatorDictionary<Dm8DataLocatorPair>();

      /// <summary>
      /// Initializes a new instance of the <see cref="Dm8DataLocatorCompareStorage"/> class.
      /// </summary>
      /// <param name="Adl">The data resource locator.</param>
      /// <param name="addLeft">if set to <c>true</c> [left].</param>
      public void StoreDm8DataLocator(bool addLeft ,Dm8LocatorBase Adl)
      {
         lock (this)
         {
            if (this.result.TryGetValue(Adl ,out Dm8DataLocatorPair value))
            {
               if (addLeft)
               {
                  if (value.left != null)
                  {
                     throw new DuplicateDm8LocatorException(Adl ,"Found twice on left side");
                  }

                  value.left = Adl;
               } else
               {
                  if (value.right != null)
                  {
                     throw new DuplicateDm8LocatorException(Adl ,"Found twice on right side");
                  }

                  value.right = Adl;
               }
            } else
            {
               var newValue = new Dm8DataLocatorPair { left = addLeft ? Adl : null ,right = addLeft ? null : Adl };
               this.result.Add(Adl ,newValue);
            }
         }
      }
   }
}

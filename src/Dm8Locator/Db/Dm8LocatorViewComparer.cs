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
using System.Diagnostics.CodeAnalysis;

/// <summary>
/// Visitor class for Table Statement
/// </summary>
namespace Dm8Locator.Db
{
   /// <summary>
   /// The 'Table' visitor for the TSql script DOM.
   /// </summary>
   public class Dm8LocatorViewComparer:IEqualityComparer<Dm8LocatorBase>
   {
      public bool Equals(Dm8LocatorBase x ,Dm8LocatorBase y)
      {
         // check if one is null and the other not
         if (ReferenceEquals(x ,null) != ReferenceEquals(y ,null))
         {
            return false;
         }

         Dm8LocatorView viewX = x as Dm8LocatorView;
         if (viewX == null)
         {
            throw new ArgumentException($"{x} is not of type column {x.GetType().ToString()}");
         }

         Dm8LocatorView viewY = y as Dm8LocatorView;
         if (viewY == null)
         {
            throw new ArgumentException($"{y} is not of type column {y.GetType().ToString()}");
         }

         // Views need to be compared by script
         string scriptX = viewX.SpecializedProperties?.GetCompareScript();
         string scriptY = viewY.SpecializedProperties?.GetCompareScript();

         return StringComparer.InvariantCultureIgnoreCase.Compare(scriptX ,scriptY) == 0;
      }

      public int GetHashCode([DisallowNull] Dm8LocatorBase obj)
      {
         throw new NotImplementedException();
      }
   }
}

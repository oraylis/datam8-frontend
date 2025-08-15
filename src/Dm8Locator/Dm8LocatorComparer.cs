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

using System.Collections.Generic;

namespace Dm8Locator
{
   /// <summary>
   /// Represents a data resource locator comparison operation that uses specific case and culture-based
   //  comparison rules.
   /// </summary>
   public class Dm8LocatorComparer
   {
      /// <summary>
      /// Ignore case for comparing data resource locators
      /// </summary>
      private static readonly Dm8DataLocatorComparerIgnoreCase Dm8lComparerIgnoreCase = new Dm8DataLocatorComparerIgnoreCase();

      /// <summary>
      /// Gets the ignore case data resource comparer
      /// </summary>
      /// <value>
      /// The ignore case comparer
      /// </value>
      public static IEqualityComparer<Dm8LocatorBase> IgnoreCase => Dm8lComparerIgnoreCase;

      /// <summary>
      /// Gets the default comparer for data resource locators (implemented as IgnoreCase)
      /// </summary>
      /// <value>
      /// The default comparer.
      /// </value>
      public static IEqualityComparer<Dm8LocatorBase> Default => Dm8lComparerIgnoreCase;
   }

}

﻿/* DataM8
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

namespace Dm8Locator
{
    /// <summary>
    /// Ignore case when comparing data resource locators
    /// </summary>
    /// <seealso cref="System.Collections.Generic.IEqualityComparer{DataRecource.Adl}" />
    public class Dm8LocatorTypeComparer : IEqualityComparer<Dm8LocatorBase>
    {
        /// <summary>
        /// The base equality comparer used in case no type specific comparer is available
        /// </summary>
        private IEqualityComparer<Dm8LocatorBase> baseEqualityComparer = Dm8LocatorComparer.Default;

        /// <summary>
        /// Dictionary of data resource locator equality comparer
        /// </summary>
        private Dictionary<Type, IEqualityComparer<Dm8LocatorBase>> equalityComparer = new Dictionary<Type, IEqualityComparer<Dm8LocatorBase>>();

        /// <summary>
        /// Adds a type specific comparer.
        /// </summary>
        /// <param name="type">The Adl type.</param>
        /// <param name="comp">The type specific comparer.</param>
        public void AddTypeComparer(Type type, IEqualityComparer<Dm8LocatorBase> comp)
        {
            this.equalityComparer.Add(type, comp);
        }

        /// <summary>
        /// Determines whether the specified objects are equal by ignoring case.
        /// </summary>
        /// <param name="x">The first object of type <paramref name="T" /> to compare.</param>
        /// <param name="y">The second object of type <paramref name="T" /> to compare.</param>
        /// <returns>
        ///   <see langword="true" /> if the specified objects are equal; otherwise, <see langword="false" />.
        /// </returns>
        public bool Equals([AllowNull] Dm8LocatorBase x, [AllowNull] Dm8LocatorBase y)
        {
           if (this.equalityComparer.TryGetValue(x.GetType(), out IEqualityComparer<Dm8LocatorBase> comp))
            {
                return comp.Equals(x, y);
            }
            else
            {
                return this.baseEqualityComparer.Equals(x, y);
            }
        }

        /// <summary>
        /// Returns a hash code for this instance.
        /// </summary>
        /// <param name="obj">The object.</param>
        /// <returns>
        /// A hash code for this instance, suitable for use in hashing algorithms and data structures like a hash table.
        /// </returns>
        public int GetHashCode([DisallowNull] Dm8LocatorBase obj)
        {
            return obj.ToString().GetHashCode();
        }
    }

}

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
    /// Dictionary for data resource locators
    /// </summary>
    /// <typeparam name="TValue">The type of the dictionary value.</typeparam>
    /// <seealso cref="Dictionary{TKey,TValue}.Adl, TValue}" />
    public class Dm8LocatorDictionary<TValue> : Dictionary<Dm8LocatorBase, TValue>
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8DataLocatorDictionary{TValue}"/> class.
        /// </summary>
        public Dm8LocatorDictionary()
            :base(Dm8LocatorComparer.Default)
        {

        }
    }


    /// <summary>
    /// Pair of Data Resource locator
    /// </summary>
    public class Dm8DataLocatorPair
    {
        public Dm8LocatorBase left;

        public Dm8LocatorBase right;
    }



    /// <summary>
    /// Pair of Data Resource locator with children
    /// </summary>
    public class Dm8DataLocatorPairWithChildren : Dm8DataLocatorPair
    {
        public Dm8LocatorDictionary<Dm8DataLocatorPair> Children = new Dm8LocatorDictionary<Dm8DataLocatorPair>();
    }

}

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
using System.Linq;
using System.Runtime.Serialization;
using System.Security.Permissions;

namespace Dm8Locator.Db
{
    [Serializable]
    public sealed class Dm8LocatorDataModule : Dm8LocatorBase
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorDataModule"/> class.
        /// </summary>
        public Dm8LocatorDataModule() : base() { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorDataModule"/> class.
        /// </summary>
        /// <param name="dm8l">The database.</param>
        public Dm8LocatorDataModule(string dm8l) : base(dm8l) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorDataModule"/> class.
        /// </summary>
        /// <param name="copy">The copy.</param>
        public Dm8LocatorDataModule(Dm8LocatorBase copy) : base(copy) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorDataModule"/> class.
        /// </summary>
        /// <param name="info">The information.</param>
        /// <param name="context">The context.</param>
        public Dm8LocatorDataModule(SerializationInfo info, StreamingContext context) : base(info, context) { }

        /// <summary>
        /// Creates the parent of type schema.
        /// </summary>
        /// <param name="dm8l">The data resource locator.</param>
        /// <returns>Parent schema</returns>
        protected override Dm8LocatorBase CreateParent(string dm8l)
        {
            return new Dm8LocatorLayer(dm8l);
        }
    }

}

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

namespace Dm8Locator.Dm8l
{
    /// <summary>
    /// Dm8-Adress for an entity
    /// </summary>
    [Serializable]
    public sealed class Dm8lEntity : Dm8LocatorBase
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8lEntity"/> class.
        /// </summary>
        public Dm8lEntity() : base() { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8lEntity"/> class.
        /// </summary>
        /// <param name="dma">The database.</param>
        public Dm8lEntity(string dma) : base(dma) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8lEntity"/> class.
        /// </summary>
        /// <param name="module">Module the entity belongs to</param>
        /// <param name="entityName">Name of entity</param>
        public Dm8lEntity(Dm8lModule module, string entityName) : base(Dm8LocatorBase.Concat(module.Value, entityName)) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8lEntity"/> class.
        /// </summary>
        /// <param name="copy">The data resource locator to copy.</param>
        public Dm8lEntity(Dm8LocatorBase copy) : base(copy) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8lEntity"/> class.
        /// </summary>
        /// <param name="info">The information.</param>
        /// <param name="context">The context.</param>
        public Dm8lEntity(SerializationInfo info, StreamingContext context) : base(info, context) { }

        /// <summary>
        /// Creates the parent of type Module
        /// </summary>
        /// <param name="Adl">The Adl.</param>
        /// <returns></returns>
        protected override Dm8LocatorBase CreateParent(string dma)
        {
            // no more parents
            return new Dm8lModule(dma);
        }
    }

}

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
using System.Runtime.Serialization;
using System.Security.Permissions;

namespace Dm8Locator.Db
{
    /// <summary>
    /// Data Resource Locator for SQL procedures
    /// </summary>
    /// <seealso cref="DataRecource.Adl" />
    [Serializable]
    public sealed class Dm8LocatorProcedure : Dm8LocatorBase
    {
        /// <summary>
        /// Gets or sets the source resources of the procedure.
        /// </summary>
        /// <value>
        /// The source resources.
        /// </value>
        public List<string> SourceResources { get; set; } = new List<string>();

        /// <summary>
        /// Gets or sets the target resources of the procedure.
        /// </summary>
        /// <value>
        /// The target resources.
        /// </value>
        public List<string> TargetResources { get; set; } = new List<string>();

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorProcedure"/> class.
        /// </summary>
        public Dm8LocatorProcedure() : base() { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorProcedure"/> class.
        /// </summary>
        /// <param name="dm8l">The dm8l.</param>
        public Dm8LocatorProcedure(string dm8l) : base(dm8l) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorProcedure"/> class.
        /// </summary>
        /// <param name="copy">The copy.</param>
        public Dm8LocatorProcedure(Dm8LocatorBase copy) : base(copy) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorProcedure"/> class.
        /// </summary>
        /// <param name="info">The information.</param>
        /// <param name="context">The context.</param>
        public Dm8LocatorProcedure(SerializationInfo info, StreamingContext context) : base(info, context) { }

        /// <summary>
        /// Creates a module parent resource locator
        /// </summary>
        /// <param name="dm8l">The dm8l.</param>
        /// <returns></returns>
        protected override Dm8LocatorBase CreateParent(string dm8l)
        {
            // no more parents
            return new Dm8LocatorDataModule(dm8l);
        }

    }

}

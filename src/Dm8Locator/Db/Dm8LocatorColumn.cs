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

using Microsoft.SqlServer.TransactSql.ScriptDom;
using System;
using System.Linq;
using System.Runtime.Serialization;
using System.Security.Permissions;

namespace Dm8Locator.Db
{

    /// <summary>
    /// Data Resource Locator for database columns
    /// </summary>
    /// <seealso cref="DataRecource.Adl" />
    [Serializable]
    public class Dm8LocatorColumn : Dm8LocatorBase
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorColumn"/> class.
        /// </summary>
        public Dm8LocatorColumn() : base() { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorColumn"/> class.
        /// </summary>
        /// <param name="dm8l">The database.</param>
        public Dm8LocatorColumn(string dm8l) : base(dm8l) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorColumn"/> class.
        /// </summary>
        /// <param name="copy">The data resource locator to copy.</param>
        public Dm8LocatorColumn(Dm8LocatorBase copy) : base(copy) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorColumn"/> class.
        /// </summary>
        /// <param name="info">The information.</param>
        /// <param name="context">The context.</param>
        public Dm8LocatorColumn(SerializationInfo info, StreamingContext context) : base(info, context) { }

        #region Column specific attributes
        /// <summary>
        /// Gets the ordinal of the column.
        /// </summary>
        /// <value>
        /// The ordinal of the column.
        /// </value>
        public short Ordinal { get; internal set; }

        /// <summary>
        /// Gets the dm8l specific type of the data.
        /// </summary>
        /// <value>
        /// The type of the data.
        /// </value>
        public Dm8DataLocatorColumnDataType DataType { get; internal set; }

        /// <summary>
        /// Gets the length of the data type.
        /// </summary>
        /// <value>
        /// The length of the data type.
        /// </value>
        public int? DataTypeLength { get; internal set; }

        /// <summary>
        /// Gets the data type precision.
        /// </summary>
        /// <value>
        /// The data type precision.
        /// </value>
        public int? DataTypePrecision { get; internal set; }

        /// <summary>
        /// Gets the data type scale.
        /// </summary>
        /// <value>
        /// The data type scale.
        /// </value>
        public int? DataTypeScale { get; internal set; }

        /// <summary>
        /// Gets a value indicating whether the column has a fixed length.
        /// </summary>
        /// <value>
        ///   <c>true</c> if column has a fixed length; otherwise, <c>false</c>.
        /// </value>
        public bool FixedLength { get; internal set; } = false;

        /// <summary>
        /// Gets a value indicating whether this column is nullable.
        /// </summary>
        /// <value>
        ///   <c>true</c> if this column is nullable; otherwise, <c>false</c>.
        /// </value>
        public bool IsNullable { get; internal set; } = true;

        /// <summary>
        /// Gets the default expression for the column.
        /// </summary>
        /// <value>
        /// The default expression of the column.
        /// </value>
        public string DefaultExpression { get; internal set; }

        /// <summary>
        /// Gets the type of the default expression.
        /// </summary>
        /// <value>
        /// The type of the default expression.
        /// </value>
        public Dm8DataLocatorColumnDataType DefaultExpressionType { get; internal set; }
        #endregion

        /// <summary>
        /// Creates the parent of a type table
        /// </summary>
        /// <param name="dm8l">The dm8l.</param>
        /// <returns></returns>
        protected override Dm8LocatorBase CreateParent(string dm8l)
        {
            // no more parents
            return new Dm8LocatorTable(dm8l);
        }
    }

}

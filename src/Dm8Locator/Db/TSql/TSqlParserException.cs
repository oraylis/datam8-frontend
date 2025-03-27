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
using System.Collections.Generic;
using System.Runtime.Serialization;

namespace Dm8Locator.Db.TSql
{
    /// <summary>
    /// Exception for TSql parser errors
    /// </summary>
    /// <seealso cref="System.Exception" />
    [Serializable]
    public class TSqlParserException : Exception
    {
        /// <summary>
        /// Gets or sets the list of parser errors (optionally).
        /// </summary>
        /// <value>
        /// The error list.
        /// </value>
        public IList<ParseError> Errors { get; set; }

        /// <summary>
        /// Initializes a new instance of the <see cref="TSqlParserException"/> class.
        /// </summary>
        /// <param name="message">The message.</param>
        public TSqlParserException(string message)
            : base(message)
        {
        }

        /// <summary>
        /// Initializes a new instance of the <see cref="TSqlParserException"/> class.
        /// Specifies the list of parser errors.
        /// </summary>
        /// <param name="message">The exception message.</param>
        /// <param name="errors">The error list.</param>
        public TSqlParserException(string message, IList<ParseError> errors)
        : base(message)
        {
            this.Errors = errors;
        }

        /// <summary>
        /// Initializes a new instance of the <see cref="TSqlParserException"/> class.
        /// </summary>
        /// <param name="message">The parser error message.</param>
        /// <param name="innerException">The inner exception.</param>
        public TSqlParserException(string message, Exception innerException)
            : base(message, innerException)
        {
        }
    }
}

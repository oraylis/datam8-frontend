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
using System.Runtime.Serialization;

namespace Dm8Locator
{
    /// <summary>
    /// Exception for duplicate data resource locators
    /// </summary>
    /// <seealso cref="System.Exception" />
    [Serializable]
    public class DuplicateDm8LocatorException : Exception
    {
        /// <summary>
        /// Gets the data resource locator which appears twice in a specific resource.
        /// </summary>
        /// <value>
        /// The invalid data resource locator.
        /// </value>
        public Dm8LocatorBase DuplicateDm8Locator { get; private set; }

        /// <summary>
        /// Initializes a new instance of the <see cref="DuplicateDm8LocatorException"/> class.
        /// </summary>
        /// <param name="duplicateAdl">The Data Resource locator used twice in one solution.</param>
        public DuplicateDm8LocatorException(Dm8LocatorBase duplicateAdl)
        {
            this.DuplicateDm8Locator = duplicateAdl;
        }

        /// <summary>
        /// Initializes a new instance of the <see cref="DuplicateDm8LocatorException"/> class.
        /// </summary>
        /// <param name="duplicateAdl">The Data Resource locator used twice in one solution.</param>
        /// <param name="message">The message.</param>
        public DuplicateDm8LocatorException(Dm8LocatorBase duplicateAdl, string message)
            : base(message)
        {
            this.DuplicateDm8Locator = duplicateAdl;
        }

        /// <summary>
        /// Initializes a new instance of the <see cref="DuplicateDm8LocatorException"/> class.
        /// </summary>
        /// <param name="duplicateAdl">The Data Resource locator used twice in one solution.</param>
        /// <param name="message">The message.</param>
        /// <param name="innerException">The inner exception.</param>
        public DuplicateDm8LocatorException(Dm8LocatorBase duplicateAdl, string message, Exception innerException)
            : base(message, innerException)
        {
            this.DuplicateDm8Locator = duplicateAdl;
        }
    }
}

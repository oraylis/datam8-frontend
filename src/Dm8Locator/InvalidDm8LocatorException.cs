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

namespace Dm8Locator
{
   /// <summary>
   /// Exception for invalid data resource locators
   /// </summary>
   /// <seealso cref="System.Exception" />
   [Serializable]
   public class InvalidDm8LocatorException:Exception
   {
      /// <summary>
      /// Gets the invalid data resource locator.
      /// </summary>
      /// <value>
      /// The invalid data resource locator.
      /// </value>
      public string InvalidDm8DataLocator { get; private set; }

      ///// <summary>
      ///// Initializes a new instance of the <see cref="InvalidDm8LocatorException"/> class.
      ///// </summary>
      ///// <param name="invalidAdl">The invalid data resource locator.</param>
      //public InvalidDm8LocatorException(string invalidAdl)
      //{
      //    this.InvalidDm8DataLocator = invalidAdl;
      //}

      /// <summary>
      /// Initializes a new instance of the <see cref="InvalidDm8LocatorException"/> class.
      /// </summary>
      /// <param name="invalidAdl">The invalid data resource locator.</param>
      /// <param name="message">The message.</param>
      public InvalidDm8LocatorException(string invalidAdl ,string message)
          : base(message)
      {
         this.InvalidDm8DataLocator = invalidAdl;
      }

      /// <summary>
      /// Initializes a new instance of the <see cref="InvalidDm8LocatorException"/> class.
      /// </summary>
      /// <param name="invalidAdl">The invalid data resource locator.</param>
      /// <param name="message">The message.</param>
      /// <param name="innerException">The inner exception.</param>
      public InvalidDm8LocatorException(string invalidAdl ,string message ,Exception innerException)
          : base(message ,innerException)
      {
         this.InvalidDm8DataLocator = invalidAdl;
      }
   }
}

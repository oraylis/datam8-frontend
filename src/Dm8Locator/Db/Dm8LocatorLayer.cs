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

namespace Dm8Locator.Db
{
   /// <summary>
   /// Data Resource Locator for database layers
   /// </summary>
   /// <seealso cref="DataRecource.Adl" />
   [Serializable]
   public sealed class Dm8LocatorLayer:Dm8LocatorBase
   {
      /// <summary>
      /// Initializes a new instance of the <see cref="Dm8LocatorLayer"/> class.
      /// </summary>
      public Dm8LocatorLayer() : base(true) { }

      /// <summary>
      /// Initializes a new instance of the <see cref="Dm8LocatorLayer"/> class.
      /// </summary>
      /// <param name="Adl">The database.</param>
      public Dm8LocatorLayer(string dm8l) : base(dm8l ,true) { }

      /// <summary>
      /// Initializes a new instance of the <see cref="Dm8LocatorLayer"/> class.
      /// </summary>
      /// <param name="copy">The data resource locator to copy.</param>
      public Dm8LocatorLayer(Dm8LocatorBase copy) : base(copy ,true) { }

      /// <summary>
      /// Initializes a new instance of the <see cref="Dm8LocatorLayer"/> class.
      /// </summary>
      /// <param name="info">The information.</param>
      /// <param name="context">The context.</param>
      public Dm8LocatorLayer(SerializationInfo info ,StreamingContext context) : base(info ,context) { }

      /// <summary>
      /// Creates the parent of type database.
      /// </summary>
      /// <param name="dm8l">The data resource locator.</param>
      /// <returns>Parent database</returns>
      protected override Dm8LocatorBase CreateParent(string dm8l)
      {
         // check if this is not the root
         if (!string.IsNullOrEmpty(dm8l) && dm8l != Dm8DataLocatorSeperator.ToString())
            throw new InvalidDm8LocatorException(dm8l ,"Layer must be root level (parent must not exist)");

         // no more parents
         return null;
      }
   }

}

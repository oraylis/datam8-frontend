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
   /// Data Resource Locator for database tables
   /// </summary>
   /// <seealso cref="DataRecource.Adl" />
   [Serializable]
   public sealed class Dm8LocatorDb:Dm8LocatorBase
   {
      /// <summary>
      /// Initializes a new instance of the <see cref="Dm8LocatorDb"/> class.
      /// </summary>
      public Dm8LocatorDb() : base() { }

      /// <summary>
      /// Initializes a new instance of the <see cref="Dm8LocatorDb"/> class.
      /// </summary>
      /// <param name="dm8l">The database.</param>
      public Dm8LocatorDb(string dm8l) : base(dm8l) { }

      /// <summary>
      /// Initializes a new instance of the <see cref="Dm8LocatorDb"/> class.
      /// </summary>
      /// <param name="copy">The data resource locator to copy.</param>
      public Dm8LocatorDb(Dm8LocatorBase copy) : base(copy) { }

      /// <summary>
      /// Initializes a new instance of the <see cref="Dm8LocatorDb"/> class.
      /// </summary>
      /// <param name="info">The information.</param>
      /// <param name="context">The context.</param>
      public Dm8LocatorDb(SerializationInfo info ,StreamingContext context) : base(info ,context) { }

      /// <summary>
      /// Creates the parent.
      /// </summary>
      /// <param name="dm8l">The dm8l.</param>
      /// <returns></returns>
      /// <exception cref="DataRecource.InvalidAdlException">Db must be root level (parent does not exist)</exception>
      protected override Dm8LocatorBase CreateParent(string dm8l)
      {
         return new Dm8LocatorDataModule(dm8l);
      }
   }

}

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
   /// Data Resource Locator for database views
   /// </summary>
   /// <seealso cref="DataRecource.Adl" />
   [Serializable]
   public sealed class Dm8LocatorView:Dm8LocatorBase
   {
      /// <summary>
      /// Initializes a new instance of the <see cref="Dm8LocatorView"/> class.
      /// </summary>
      public Dm8LocatorView() : base() { }

      /// <summary>
      /// Initializes a new instance of the <see cref="Dm8LocatorView"/> class.
      /// </summary>
      /// <param name="db">The database.</param>
      public Dm8LocatorView(string db) : base(db) { }

      /// <summary>
      /// Initializes a new instance of the <see cref="Dm8LocatorView"/> class.
      /// </summary>
      /// <param name="copy">The copy.</param>
      public Dm8LocatorView(Dm8LocatorBase copy) : base(copy) { }

      /// <summary>
      /// Initializes a new instance of the <see cref="Dm8LocatorView"/> class.
      /// </summary>
      /// <param name="info">The information.</param>
      /// <param name="context">The context.</param>
      public Dm8LocatorView(SerializationInfo info ,StreamingContext context) : base(info ,context) { }

      /// <summary>
      /// Creates the parent of type Module
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

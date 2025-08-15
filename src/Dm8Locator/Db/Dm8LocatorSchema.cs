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
   [Serializable]
   public sealed class Dm8LocatorSchema:Dm8LocatorBase
   {
      public Dm8LocatorSchema() : base() { }
      public Dm8LocatorSchema(string dm8l) : base(dm8l) { }
      public Dm8LocatorSchema(Dm8LocatorBase copy) : base(copy) { }
      public Dm8LocatorSchema(SerializationInfo info ,StreamingContext context) : base(info ,context) { }

      protected override Dm8LocatorBase CreateParent(string dm8l)
      {
         // no more parents
         return new Dm8LocatorDb(dm8l);
      }
   }

}

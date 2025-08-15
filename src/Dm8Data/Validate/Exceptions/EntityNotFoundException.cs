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

namespace Dm8Data.Validate.Exceptions
{
   public class EntityNotFoundException:ModelReaderException
   {
      public const string MessageFormat = "Entity with locator '{0}' not found";

      public string Dm8l { get; set; }

      public EntityNotFoundException(string dm8l)
      {
         this.Code = "R002";
         this.Dm8l = dm8l;
      }

      public override string Message => string.Format(MessageFormat ,this.Dm8l);

      public override string Source
      {
         get => $"Entity Error: Locator {this.Dm8l} not found";
      }
   }
}

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

using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dm8Data.Validate.Exceptions;

namespace Dm8Data.Validate
{

   public class DiagramModelReader:ModelReader<Dm8Data.Diagram.Diagram>
   {
      public override async Task<IEnumerable<ModelReaderException>> ValidateObjectAsync(SolutionHelper solutionHelper ,Dm8Data.Diagram.Diagram item)
      {
         var rc = new List<ModelReaderException>();

         if (item == null)
         {
            return rc;
         }

         // check source entities
         if (item.CoreEntities != null)
         {
            rc.AddRange(item.CoreEntities.Where(dm8l => solutionHelper.GetFileName(dm8l) == null)
                .Select(dm8l => new EntityNotFoundException(dm8l)));

         }

         await Task.Yield();

         return rc;
      }
   }
}

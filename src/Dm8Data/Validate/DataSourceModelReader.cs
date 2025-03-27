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
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Dm8Data.Validate.Exceptions;

namespace Dm8Data.Validate
{

    public class DataSourceModelReader : ModelReaderList<DataSources.DataSource, DataSources.DataSources>
    {
        public override async Task<IEnumerable<ModelReaderException>> ValidateAsync(SolutionHelper solutionHelper, IEnumerable<DataSources.DataSource> list)
        {
            var rc = new List<ModelReaderException>();

            // add exceptions for unique constraint
            rc.AddRange(await ValidateUniqueness<DataSources.DataSource>.
                ValidateAsync(list, (o) => o.Name));


            var refList = await solutionHelper.LoadOrGetModelList<DataTypes.DataType, DataTypes.DataTypes>(solutionHelper.Solution.DataTypesFilePath);


            rc.AddRange(await ValidateReference<DataSources.DataTypeMapping, DataTypes.DataType>.
                ValidateListAsync(
                    "base/source",
                    list.Where(i => i.DataTypeMapping != null).SelectMany(i => i.DataTypeMapping),
                    refList.ToList(),
                    (o, r) => new Tuple<string, string>(o.TargetType, r.Name)
                ));
            return rc;
        }
    }
}

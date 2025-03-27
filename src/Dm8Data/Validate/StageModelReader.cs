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
using Dm8Data.DataProducts;
using Dm8Data.Stage;
using Dm8Data.Validate.Exceptions;

namespace Dm8Data.Validate
{

    public class StageModelReader
        : ModelReader<Dm8Data.Stage.ModelEntry>
    {
        public override async Task<IEnumerable<ModelReaderException>> ValidateObjectAsync(SolutionHelper solutionHelper, ModelEntry item)
        {
            var rc = new List<ModelReaderException>();

            if (item?.Entity == null)
                return rc;

            // add exceptions for unique constraint
            var refList = await solutionHelper.LoadOrGetModelList<DataTypes.DataType, DataTypes.DataTypes>(solutionHelper.Solution.DataTypesFilePath);

            rc.AddRange(await ValidateReference<Dm8Data.Stage.Attribute, DataTypes.DataType>.
                          ValidateListAsync(
                                item.Entity.Dm8l,
                                item.Entity.Attribute,
                                refList.ToList(),
                                (o, r) => new Tuple<string, string>(o.Type, r.Name)
                          ));

            // validation of data product/module
            var prodList = await solutionHelper.LoadOrGetModelList<DataProducts.DataProduct, DataProducts.DataProducts>(solutionHelper.Solution.DataProductsFilePath);

            var moduleEntry = prodList
                .SelectMany(dp => dp.Module.Select(mo => new { Product = dp.Name, Module = mo.Name }))
                .FirstOrDefault(e => item.Entity.DataProduct == e.Product && item.Entity.DataModule == e.Module);

            if (moduleEntry == null)
            {
                Tuple<string, string>[] fields =
                {
                    new Tuple<string, string>("DataProduct", "Name"),
                    new Tuple<string, string>("DataModule", "Module.Name")
                };
                string[] vals = { item.Entity.DataProduct, item.Entity.DataModule };
                rc.Add(new ReferenceException
                {
                    SourceObject = nameof(StageEntity),
                    TargetObject = nameof(DataProduct),
                    FieldNames = new List<Tuple<string, string>>(fields),
                    ValueList = new List<string>(vals)
                });
            }

            return rc;
        }
    }
}

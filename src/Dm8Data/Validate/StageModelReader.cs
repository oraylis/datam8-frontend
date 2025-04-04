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

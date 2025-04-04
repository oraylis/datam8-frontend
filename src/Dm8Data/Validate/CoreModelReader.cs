using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Xml.Serialization;
using Dm8Data.Core;
using Dm8Data.DataProducts;
using Dm8Data.Validate.Exceptions;

namespace Dm8Data.Validate
{

    public class CoreModelReader : ModelReader<Dm8Data.Core.ModelEntry>
    {
        public override async Task<IEnumerable<ModelReaderException>> ValidateObjectAsync(SolutionHelper solutionHelper, Dm8Data.Core.ModelEntry item)
        {
            var rc = new List<ModelReaderException>();

            if (item == null)
                return rc;

            // add exceptions for unique constraint
            var refList = await solutionHelper.LoadOrGetModelList<DataTypes.DataType, DataTypes.DataTypes>(solutionHelper.Solution.DataTypesFilePath);

            rc.AddRange(await ValidateReference<Dm8Data.Core.Attribute, DataTypes.DataType>.
                          ValidateListAsync(
                                item.Entity.Dm8l,
                                item.Entity.Attribute,
                                refList.ToList(),
                                (o, r) => new Tuple<string, string>(o.DataType, r.Name)
                          ));

            // validation of data product/module
            var prodList = await solutionHelper.LoadOrGetModelList<DataProducts.DataProduct, DataProducts.DataProducts>(solutionHelper.Solution.DataProductsFilePath);

            var moduleEntry = prodList
                .SelectMany(dp => dp.Module.Select(mo => new { Product = dp.Name, Module = mo.Name }))
                .FirstOrDefault(e => item.Entity.DataProduct == e.Product && item.Entity.DataModule == e.Module);


            // validation of data product/module
            var attrList = await solutionHelper.LoadOrGetModelList<AttributeTypes.AttributeType, AttributeTypes.AttributeTypes>(solutionHelper.Solution.AttributeTypesFilePath);

            rc.AddRange(await ValidateReference<Dm8Data.Core.Attribute, AttributeTypes.AttributeType>.
                ValidateListAsync(
                    item.Entity.Dm8l,
                    item.Entity.Attribute,
                    attrList.ToList(),
                    (a, t) => new Tuple<string, string>(a.AttributeType, t.Name)
                ));

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
                    SourceObject = nameof(CoreEntity),
                    TargetObject = nameof(DataProduct),
                    FieldNames = new List<Tuple<string, string>>(fields),
                    ValueList = new List<string>(vals)
                });
            }

            // special implementation for foreign key definition
            rc.AddRange(await ValidateForeignKey.ValidateAsync(item, solutionHelper.LoadOrGetCoreEntityAsync));

            // check source entities
            rc.AddRange(item.Function.Source.Where(s => s.Dm8l != "#" && solutionHelper.GetFileName(s.Dm8l) == null)
                .Select(s => new EntityNotFoundException(s.Dm8l)));

            return rc;
        }
    }
}

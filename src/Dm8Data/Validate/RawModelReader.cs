using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Dm8Data.DataProducts;
using Dm8Data.Raw;
using Dm8Data.Validate.Exceptions;

namespace Dm8Data.Validate
{

    public class RawModelReader : ModelReader<Raw.ModelEntry>
    {       
        public override async Task<IEnumerable<ModelReaderException>> ValidateObjectAsync(SolutionHelper solutionHelper, Raw.ModelEntry item)
        {
            var rc = new List<ModelReaderException>();

            if (item == null || item?.Entity == null)
                return rc;

            // validation of data product/module
            var prodList = await solutionHelper.LoadOrGetModelList<DataProducts.DataProduct, DataProducts.DataProducts>(solutionHelper.Solution.DataProductsFilePath);

            var moduleEnty = prodList
                .SelectMany(dp => dp.Module.Select(mo => new { Product = dp.Name, Module = mo.Name }))
                .FirstOrDefault(e => item.Entity.DataProduct == e.Product && item.Entity.DataModule == e.Module);

            if (moduleEnty == null)
            {
                Tuple<string, string>[] fields =
                {
                    new Tuple<string, string>("DataProduct", "Name"),
                    new Tuple<string, string>("DataModule", "Module.Name")
                };
                string[] vals = { item.Entity.DataProduct, item.Entity.DataModule };
                rc.Add(new ReferenceException
                {
                    SourceObject = nameof(RawEntity),
                    TargetObject = nameof(DataProduct),
                    FieldNames = new List<Tuple<string, string>>(fields),
                    ValueList = new List<string>(vals)
                });
            }


            return rc;
        }
    }
}

using System;
using System.Collections.Generic;
using System.Text;
using System.Threading.Tasks;
using Dm8Data.Validate.Exceptions;

namespace Dm8Data.Validate
{

    public class DataProductModelReader : ModelReaderList<DataProducts.DataProduct, DataProducts.DataProducts>
    {
        public override async Task<IEnumerable<ModelReaderException>> ValidateAsync(SolutionHelper solutionHelper, IEnumerable<DataProducts.DataProduct> list)
        {
            var rc = new List<ModelReaderException>();

            // add exceptions for unique constraint
            rc.AddRange(await ValidateUniqueness<DataProducts.DataProduct>.ValidateAsync(list, (o) => o.Name));

            return rc;
        }
    }
}

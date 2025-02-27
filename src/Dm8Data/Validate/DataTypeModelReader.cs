using System;
using System.Collections.Generic;
using System.Text;
using System.Threading.Tasks;
using Dm8Data.Validate.Exceptions;

namespace Dm8Data.Validate
{

    public class DataTypeModelReader : ModelReaderList<DataTypes.DataType, DataTypes.DataTypes>
    {
        public override async Task<IEnumerable<ModelReaderException>> ValidateAsync(SolutionHelper solutionHelper, IEnumerable<DataTypes.DataType> list)
        {
            var rc = new List<ModelReaderException>();

            // add exceptions for unique constraint
            rc.AddRange(await ValidateUniqueness<DataTypes.DataType>.ValidateAsync(list, (o) => o.Name));

            return rc;
        }
    }
}

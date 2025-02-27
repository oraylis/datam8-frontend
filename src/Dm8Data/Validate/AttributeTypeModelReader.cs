using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Dm8Data.Validate.Exceptions;

namespace Dm8Data.Validate
{

    public class AttributeTypeModelReader : ModelReaderList<AttributeTypes.AttributeType, AttributeTypes.AttributeTypes>
    {
        public override async Task<IEnumerable<ModelReaderException>> ValidateAsync(SolutionHelper solutionHelper, IEnumerable<AttributeTypes.AttributeType> list)
        {
            var rc = new List<ModelReaderException>();

            // add exceptions for unique constraint
            rc.AddRange(await ValidateUniqueness<AttributeTypes.AttributeType>.ValidateAsync(list, (o) => o.Name));

            // data type
            var refList = await solutionHelper.LoadOrGetModelList<DataTypes.DataType, DataTypes.DataTypes>(solutionHelper.Solution.DataTypesFilePath);

            rc.AddRange(await ValidateReference<AttributeTypes.AttributeType, DataTypes.DataType>.
                ValidateListAsync(
                    "base/attribute",
                    list,
                    refList.ToList(),
                    (a, r) => new Tuple<string, string>(a.DefaultType, r.Name)
                ));


            return rc;
        }
    }
}

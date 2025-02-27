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

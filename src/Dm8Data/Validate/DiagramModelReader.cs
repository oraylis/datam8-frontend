using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Xml.Serialization;
using Dm8Data.Curated;
using Dm8Data.DataProducts;
using Dm8Data.Validate.Exceptions;

namespace Dm8Data.Validate
{

    public class DiagramModelReader : ModelReader<Dm8Data.Diagram.Diagram>
    {
        public override async Task<IEnumerable<ModelReaderException>> ValidateObjectAsync(SolutionHelper solutionHelper, Dm8Data.Diagram.Diagram item)
        {
            var rc = new List<ModelReaderException>();

            if (item == null)
                return rc;

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

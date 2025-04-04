using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dm8Data.Validate.Exceptions;

namespace Dm8Data.Validate.Base
{
    public interface IModelReader
    {
        Task<object> ReadFromFileAsync(string fileName);

        Task<object> ReadFromStringAsync(string json);

        Task<IEnumerable<ModelReaderException>> ValidateObjectAsync(SolutionHelper solutionHelper, object o);
    }
}

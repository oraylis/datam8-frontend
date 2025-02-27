using System;
using System.Collections;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dm8Data.Validate.Exceptions;

namespace Dm8Data.Validate.Base
{
    public interface IModelReaderList : IModelReader
    {
        new Task<IEnumerable> ReadFromFileAsync(string fileName);

        new Task<IEnumerable> ReadFromStringAsync(string json);

        Task<IEnumerable<ModelReaderException>> ValidateAsync(SolutionHelper solutionHelper, IEnumerable list);
    }
}

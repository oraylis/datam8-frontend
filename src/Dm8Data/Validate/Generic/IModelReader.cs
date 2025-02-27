using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dm8Data.Validate.Base;
using Dm8Data.Validate.Exceptions;

namespace Dm8Data.Validate.Generic
{
    public interface IModelReader<TObj> : IModelReader
        where TObj : class, new()
    {
        new Task<TObj> ReadFromFileAsync(string fileName);

        new Task<TObj> ReadFromStringAsync(string json);

        Task<IEnumerable<SchemaValidateException>> ValidateSchemaFromFileAsync(string file);

        Task<IEnumerable<SchemaValidateException>> ValidateSchemaFromStringAsync(string json);

        Task<IEnumerable<ModelReaderException>> ValidateObjectAsync(SolutionHelper solutionHelper, TObj o);
    }
}

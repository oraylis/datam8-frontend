using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dm8Data.Validate;
using Dm8Data.Validate.Base;
using Dm8Data.Validate.Exceptions;

namespace Dm8Data.Validate.Generic
{
    public interface IModelReaderList<TObj> : IModelReaderList
        where TObj : class, new()
    {
        new Task<IEnumerable<TObj>> ReadFromFileAsync(string fileName);

        new Task<IEnumerable<TObj>> ReadFromStringAsync(string json);
    }
}

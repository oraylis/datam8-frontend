using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Dm8Data.Validate.Exceptions;

namespace Dm8Data.Validate
{
    public class ValidationResult
    {
        public IEnumerable<ModelReaderException> ValidationExceptions { get; set; }
    }
}

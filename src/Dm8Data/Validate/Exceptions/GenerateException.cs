using System;
using Dm8Data.Helper;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Collections;

namespace Dm8Data.Validate.Exceptions
{
    public class GenerateException : ModelReaderException
    {
        public const string MessageFormat0 = "Generate Exception {0}";

        public GenerateException(string message)
            : base(message)
        {
            this.Code = "G001";            
        }

        public override string Message
        { 
            get
            {
                return string.Format(MessageFormat0, this.InnerException?.Message);
            } 
        }

        public override string Source
        {
            get
            {
                return string.Format(MessageFormat0, this.InnerException?.Message);
            }
        }
     
    }
}

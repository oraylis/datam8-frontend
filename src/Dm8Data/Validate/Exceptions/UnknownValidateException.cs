using System;
using Dm8Data.Helper;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Collections;

namespace Dm8Data.Validate.Exceptions
{
    public class UnknownValidateException : ModelReaderException
    {
        public const string MessageFormat0 = "Unknown Validate Exception {0}";

        public UnknownValidateException(Exception ex, string filepath)
            : base("Unknown Validate Exception", ex)
        {
            this.Code = "UNKNOWN";            
            this.FilePath = filepath;
        }

        public UnknownValidateException(string msg, string filepath)
            : base("Unknown Validate Exception", new Exception(msg))
        {
            this.Code = "UNKNOWN";
            this.FilePath = filepath;
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

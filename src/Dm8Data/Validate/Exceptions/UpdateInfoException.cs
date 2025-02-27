using System;
using Dm8Data.Helper;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Collections;

namespace Dm8Data.Validate.Exceptions
{
    public class UpdateInfoException : ModelReaderException
    {
        public const string MessageFormat0 = "Model update {0}";

        public UpdateInfoException(Exception ex, string filepath)
            : base("Model Update", ex)
        {
            this.Severity = SeverityType.Info;
            this.Code = "UPDATE";            
            this.FilePath = filepath;
        }

        public UpdateInfoException(string msg, string filepath)
            : base("Model Update", new Exception(msg))
        {
            this.Severity = SeverityType.Info;
            this.Code = "UPDATE";
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
                return this.FilePath;
            }
        }
     
    }
}

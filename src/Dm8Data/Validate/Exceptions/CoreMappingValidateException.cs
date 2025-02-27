using System;
using Dm8Data.Helper;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Collections;

namespace Dm8Data.Validate.Exceptions
{
    public class CoreMappingValidateException : ModelReaderException
    {
        public const string MessageFormat0 = "Core entity {0}: Attribute {0} of mapping for {1} does not exist";

        public string CoreEntityAdl { get; set; }

        public string SourceEntityAdl { get; set; }

        public string AttributeName { get; set; }

        public CoreMappingValidateException(string coreAdl, string srcAdl, string attrName, string filepath)
            : base("Core Mapping Error")
        {
            this.Code = "C01";
            this.FilePath = filepath;
            this.CoreEntityAdl = coreAdl;
            this.SourceEntityAdl = srcAdl;
            this.AttributeName = attrName;
        }

        public CoreMappingValidateException(string msg, string filepath)
            : base("Unknown Validate Exception", new Exception(msg))
        {
            this.Code = "C01";
            this.FilePath = filepath;
        }

        public override string Message => string.Format(MessageFormat0, this.CoreEntityAdl, this.SourceEntityAdl, this.AttributeName);

        public override string Source => this.FilePath;
    }
}

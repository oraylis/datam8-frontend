using System;
using Dm8Data.Helper;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Collections;

namespace Dm8Data.Validate.Exceptions
{
    public class TargetDataTypeNotFoundException : ModelReaderException
    {
        public const string MessageFormat = "Target data type '{0}' not found for mapping from source {1}";

        public override string Message
        { 
            get
            {
                return string.Format(MessageFormat, this.TargetDataType, this.SourceDataType);
            } 
        }

        public override string Source
        {
            get
            {
                return $"Data Source: {this.DataSource}";
            }
        }

        public string TargetDataType { get; set; }

        public string SourceDataType {  get; set; }

        public string DataSource { get; set; }

    }
}

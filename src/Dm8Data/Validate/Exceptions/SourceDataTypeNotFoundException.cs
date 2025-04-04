using System;
using Dm8Data.Helper;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Collections;

namespace Dm8Data.Validate.Exceptions
{
    public class SourceDataTypeNotFoundException : ModelReaderException
    {
        public const string MessageFormat = "Source data type '{0}' not found in type mapping";

        public override string Message
        { 
            get
            {
                return string.Format(MessageFormat, this.SourceDataType);
            } 
        }

        public override string Source
        {
            get
            {
                return $"Data Source: {this.DataSource}";
            }
        }


        public string SourceDataType {  get; set; }

        public string DataSource { get; set; }

    }
}

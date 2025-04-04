using System;
using Dm8Data.Helper;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Collections;

namespace Dm8Data.Validate.Exceptions
{
    public class NotNullExpressionException : ModelReaderException
    {
        public const string MessageFormat = "Value not specified for '{0}'";

        public NotNullExpressionException()
        {
            this.Code = "F002";
        }

        public override string Message
        { 
            get
            {
                return string.Format(MessageFormat, this.Field);
            } 
        }

        public override string Source
        {
            get
            {
                return $"Not Null Error: '{this.Field}'";
            }
        }

        public string Field { get; set;  }


    }
}

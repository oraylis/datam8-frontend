using System;
using Dm8Data.Helper;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Collections;

namespace Dm8Data.Validate.Exceptions
{
    public class UniqueExpressionException : ModelReaderException
    {
        public const string MessageFormat0 = "Unique error without field information";

        public const string MessageFormat1 = "Value not unique '{0}'";

        public const string MessageFormat2 = "Value combination not unique '{0}'";

        public UniqueExpressionException()
        {
            this.Code = "F001";
        }

        public override string Message
        { 
            get
            {
                if (this.FieldList.Count == 1)
                    return string.Format(MessageFormat1, this.ValueList.ToCommaList());
                else if (this.FieldList.Count > 1)
                    return string.Format(MessageFormat2, this.ValueList.ToCommaList());
                else
                    return MessageFormat0;
            } 
        }

        public override string Source
        {
            get
            {
                return $"Unique Error: '{this.FieldList.ToCommaList()}'";
            }
        }

        public List<string> FieldList { get; set;  }

        public List<string> ValueList { get; set; }

        public ICollection ObjectList { get; set; }

    }
}

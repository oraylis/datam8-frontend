using System;
using Dm8Data.Helper;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Collections;

namespace Dm8Data.Validate.Exceptions
{
    public class ReferenceException : ModelReaderException
    {
        public const string MessageFormat0 = "Reference error without field information";

        public const string MessageFormat1 = "Reference '{0}' not found for attribute '{1}'";

        public const string MessageFormat2 = "References '{0}' not found for attribute '{1}'";

        public ReferenceException()
        {
            this.Code = "R001";
        }

        public override string Message
        { 
            get
            {
                if (this.ValueList.Count == 1)
                    return string.Format(MessageFormat1, this.ValueList.ToCommaList(), this.FieldNames.Select(i => i.Item1).ToCommaList());
                if (this.ValueList.Count > 1)
                    return string.Format(MessageFormat2, this.ValueList.ToCommaList(), this.FieldNames.Select(i => i.Item1).ToCommaList());
                else
                    return MessageFormat0;
            } 
        }

        public override string Source
        {
            get => $"Reference Error: {this.SourceObject} ({this.FieldNames.Select(i => i.Item1).ToCommaList()}) to {this.TargetObject} ({this.FieldNames.Select(i => i.Item2).ToCommaList()}) ";
        }


        public string SourceObject {  get; set; }

        public string TargetObject { get; set; }

        public List<Tuple<string, string>> FieldNames { get; set;  }

        public List<string> ValueList { get; set; }


    }
}

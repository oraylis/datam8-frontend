using System;
using Dm8Data.Helper;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Collections;

namespace Dm8Data.Validate.Exceptions
{
    public class SchemaValidateException : ModelReaderException
    {
        private readonly int line;
        private readonly int pos;

        public const string MessageFormat0 = "Line: {0} Pos: {1}";

        public SchemaValidateException(string message, int lineNo, int pos, string filePath)
        : base(message)
        {
            this.pos = pos;
            this.line = lineNo;
            this.FilePath = filePath;
        }

        public override string Message => base.Message;

        public override string Source => string.Format(MessageFormat0, this.line, this.pos);
    }
}

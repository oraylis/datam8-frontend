using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Dm8CSVConnector.Classes
{
    public class ConvertProperty
    {
        public enum ReadFileAsProp
        {
            ANSI = 0,
            OEM = 1
        }

        public enum DelimiterProp
        {
            Semicolon = 0,
            Comma = 1,
            Tab = 2
        }
        public enum SeparatorProp
        {
            CRLF = 0,
            CR = 1,
            LF = 2
        }
        public bool HeaderHasFieldnames { get; set; } = true;
        public ReadFileAsProp ReadFileAs { get; set; } = ReadFileAsProp.ANSI;
        public DelimiterProp Delimiter { get; set; } = DelimiterProp.Comma;
        public SeparatorProp Separator { get; set; } = SeparatorProp.CRLF;


        [Newtonsoft.Json.JsonIgnore]
        public string GetSeparator
        {
            get
            {
                switch (Separator)
                {
                    case SeparatorProp.CRLF:
                        return "\r\n";
                    case SeparatorProp.CR:
                        return "\r";
                    case SeparatorProp.LF:
                        return "\n";
                }
                throw new Exception("Invalid Line Separator");
            }
        }
        
        [Newtonsoft.Json.JsonIgnore]
        public string GetDelimiter
        {
            get
            {
                switch (Delimiter)
                {
                    case DelimiterProp.Comma:
                        return ",";
                    case DelimiterProp.Semicolon:
                        return ";";
                    case DelimiterProp.Tab:
                        return "\t";
                }
                throw new Exception("Invalid Field Delimiter");
            }
        }
    }
}

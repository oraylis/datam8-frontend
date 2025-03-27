/* DataM8
 * Copyright (C) 2024-2025 ORAYLIS GmbH
 *
 * This file is part of DataM8.
 *
 * DataM8 is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * DataM8 is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

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

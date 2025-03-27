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

using PoorMansTSqlFormatterRedux.Formatters;
using PoorMansTSqlFormatterRedux.Interfaces;
using PoorMansTSqlFormatterRedux.Parsers;
using PoorMansTSqlFormatterRedux.Tokenizers;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Dm8Locator
{
    public class Dm8LocatorParser
    {
        public static string PrettyPrintSQL(string sql)
        {
            // Format script
            TSqlStandardTokenizer tokenizer = new TSqlStandardTokenizer();
            TSqlStandardParser parser = new TSqlStandardParser();
            TSqlStandardFormatter treeFormatter = new TSqlStandardFormatter();
            treeFormatter.Options.TrailingCommas = false;
            ITokenList tokenized = tokenizer.TokenizeSQL(sql);
            var parsed = parser.ParseSQL(tokenized);
            return treeFormatter.FormatSQLTree(parsed);
        }
    }
}

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

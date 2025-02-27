using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.SqlServer.TransactSql.ScriptDom;

namespace Dm8Data.Helper
{
    public class PathHelper
    {
        public static string Combine(string path1, string path2)
        {
            string retVal = "";

            while (path1.EndsWith(@"\"))
            {
                path1 = path1.Substring(0, path1.Length - 1);
            }
            while (path2.StartsWith(@"\"))
            {
                path2 = path2.Substring(1);
            }

            retVal = Path.Combine(path1, path2);

            return (retVal);
        }
    }
}

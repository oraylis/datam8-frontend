using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Encodings.Web;
using System.Threading.Tasks;

namespace Dm8PluginBase.Helper
{
    public class StringHelper
    {

        public static string Encode(string str)
        {
            str = Uri.EscapeDataString(str);
            return (str);
        }
        public static string Decode(string str)
        {
            str = Uri.UnescapeDataString(str);
            return (str);
        }

    }
}

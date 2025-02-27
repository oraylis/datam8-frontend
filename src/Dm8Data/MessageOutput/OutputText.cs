using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Dm8Data.MessageOutput
{
    public class OutputText
    {
        public OutputText()
        {
            this.Content = new StringBuilder();
            this.List = new List<string>();
        }

        public StringBuilder Content { get; set; }

        public List<string> List { get; set; }
    }
}

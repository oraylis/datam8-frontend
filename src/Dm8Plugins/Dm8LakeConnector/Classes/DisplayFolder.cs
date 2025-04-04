using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Dm8LakeConnector.Classes
{
#pragma warning disable CS8632
#pragma warning disable CS8602
#pragma warning disable CS8618
#pragma warning disable CS8600
    public class DisplayFolder
    {
        public string Name { get; set; }
        public string FullName { get; set; }
        public List<DisplayFolder> Folders { get; set; } = new List<DisplayFolder>();
    }
}

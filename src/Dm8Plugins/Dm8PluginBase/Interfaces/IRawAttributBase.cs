using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Dm8PluginBase.Interfaces
{
    internal interface IRawAttributBase
    {
        public string Name { get; set; }
        public string Type { get; set; }
        public int? CharLength { get; set; }
        public string CharSet { get; set; }
        public int? Precision { get; set; }
        public int? Scale { get; set; }
        public bool? Nullable { get; set; }
        public string UnitName { get; set; }
        public string UnitType { get; set; }
        public System.Collections.ObjectModel.ObservableCollection<string> Tags { get; set; }
        public string? DateModified { get; set; }
        public string? DateDeleted { get; set; }
    }
}

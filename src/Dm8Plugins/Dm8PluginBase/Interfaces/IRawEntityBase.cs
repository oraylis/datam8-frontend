using Dm8PluginBase.BaseClasses;
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Dm8PluginBase.Interfaces
{
    public interface IRawEntityBase
    {
        string DataModule { get; set; }
        string DataProduct { get; set; }
        string Name { get; set; }
        public string ObjectType { get; set; }
        string DisplayName { get; set; }
        string Dm8l { get; }
        public ObservableCollection<RawAttributBase> Attribute { get; set; }
    }
}

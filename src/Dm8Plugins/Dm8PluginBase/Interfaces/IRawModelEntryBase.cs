using System.Text.Json.Nodes;
using Dm8PluginBase.BaseClasses;
using Newtonsoft.Json;

namespace Dm8PluginBase.Interfaces
{
    public interface IRawModelEntryBase
    {
        [JsonIgnore]
        string Schema { get; set; }

        public dynamic Type { get; set; }

        [Newtonsoft.Json.JsonProperty("entity")]
        RawEntityBase Entity { get; set; }
        
        [Newtonsoft.Json.JsonProperty("function")]
        RawFunctionBase Function { get; set; }
    }
}

using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Dm8PluginBase.Interfaces;
using Newtonsoft.Json;
using CategoryAttribute = PropertyTools.DataAnnotations.CategoryAttribute;


namespace Dm8CSVConnector.Classes
{
    public class FieldProperty
    {
        public string Name { get; set; } = "";
        public string Type { get; set; } = "string";
        
        [JsonProperty(NullValueHandling = NullValueHandling.Ignore)]
        public int? Size { get; set; }
        
        [JsonProperty(NullValueHandling = NullValueHandling.Ignore)] 
        public int? Precision { get; set; }
        
        public bool NullEnabled { get; set; } = true;

        [Newtonsoft.Json.JsonIgnore]
        public string SampleData { get; set; } = "";

        public override string ToString()
        {
            return this.Name;
        }
    }
}

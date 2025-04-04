using Dm8PluginBase.Interfaces;
using System.Collections.ObjectModel;

namespace Dm8PluginBase.BaseClasses
{
    public class RawEntityBase : Prism.Mvvm.BindableBase, IRawEntityBase
    {
        public string DataModule { get; set; } = "";
        public string DataProduct { get; set; } = "";
        public string Name { get; set; } = "";
        public string DisplayName { get; set; } = "";
        [Newtonsoft.Json.JsonIgnore] 
        public string ObjectType { get; set; } = "";
        public ObservableCollection<RawAttributBase> Attribute { get; set; } = new ObservableCollection<RawAttributBase>();
        public string Dm8l
        {
            get
            {
                return $"/Raw/{this.DataProduct}/{this.DataModule}/{this.Name}";
            }
        }
        public string FolderName { get; set; } = "";    
    }
}

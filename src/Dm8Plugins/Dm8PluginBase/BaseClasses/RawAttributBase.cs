using Dm8PluginBase.Interfaces;

namespace Dm8PluginBase.BaseClasses
{
#pragma warning disable CS8625
#pragma warning disable CS8618
    public class RawAttributBase : Prism.Mvvm.BindableBase, IRawAttributBase
    {
        public string Name { get; set; } = "";
        public string Type { get; set; } = "";
        public int? CharLength { get; set; }
        public string CharSet { get; set; } = "";
        public int? Precision { get; set; }
        public int? Scale { get; set; }
        public bool? Nullable { get; set; }
        public string UnitName { get; set; } = "";
        public string UnitType { get; set; } = "";
        public System.Collections.ObjectModel.ObservableCollection<string> Tags { get; set; }
        public string? DateModified { get; set; }
        public string? DateDeleted { get; set; }
    }
}

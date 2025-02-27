using Dm8PluginBase.Interfaces;

namespace Dm8PluginBase.BaseClasses
{
    public class RawModelEntryBase : Prism.Mvvm.BindableBase ,IRawModelEntryBase
    {
        public string Schema { get; set; } = "";
        public dynamic Type { get; set; } = "";
        public RawEntityBase Entity { get; set; } = new RawEntityBase();
        public RawFunctionBase Function { get; set; }= new RawFunctionBase();
    }
}


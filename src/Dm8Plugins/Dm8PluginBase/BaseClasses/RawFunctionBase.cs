using Dm8PluginBase.Interfaces;

namespace Dm8PluginBase.BaseClasses
{
    public class RawFunctionBase : IRawFunctionBase
    {
        public string DataSource { get; set; } = "";
        public string SourceLocation { get; set; } = "";
    }
}

using Dm8PluginBase.Interfaces;

namespace Dm8PluginBase.BaseClasses
{
    public partial class DataSourceBase : IDataSourceBase
    {
        public string Name { get; set; } = "";
        public string DisplayName { get; set; } = "";
        public string Purpose { get; set; } = "";
        public string ConnectionString { get; set; } = "";  
        public Dictionary<string, string> ExtendedProperties { get; set; } = new Dictionary<string, string>();
        public bool RealConnectionString { get; set; } = false;
        public bool Validate(bool showMessage)
        {
            return false;
        }
        public bool Connect(string connectionString)
        {
            throw new NotImplementedException();
        }

    }
}

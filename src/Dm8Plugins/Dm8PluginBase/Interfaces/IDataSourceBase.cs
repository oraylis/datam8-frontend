using System.ComponentModel;

namespace Dm8PluginBase.Interfaces;

public interface IDataSourceBase
{
    [Browsable(false)]
    string Name { get; set; }
    string DisplayName { get; set; }
    string Purpose { get; set; }
    string ConnectionString { get; set; }
    [Browsable(false)]
    bool RealConnectionString { get; set; }
    public Dictionary<string, string> ExtendedProperties { get; set; }
    public bool Validate(bool showMessage);
    public bool Connect(string connectionString);
}
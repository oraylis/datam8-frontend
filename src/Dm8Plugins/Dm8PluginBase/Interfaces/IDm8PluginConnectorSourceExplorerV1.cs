using Dm8PluginBase.BaseClasses;

namespace Dm8PluginBase.Interfaces
{
    public interface IDm8PluginConnectorSourceExplorerV1
    {
        public DataSourceBase Source { get; set; }
        public string Name { get; }
        public string Layer { get; set; }
        public string DataModule { get; set; }
        public string DataProduct { get; set; }
        public string DataSourceName { get; set; }
        public Dictionary<string, string> DefaultDatatypes { get; }
        public bool ConfigureConnection(ref string conStr, Dictionary<string, string> extendedProperties);
        public Task ConnectAsync(string connectionString);

        public Task<IList<RawModelEntryBase>> SelectObjects(Func<string, bool> addFiles);

        public Task<DateTime> RefreshAttributesAsync(RawModelEntryBase selectedEntity, bool update = false);
    }
}

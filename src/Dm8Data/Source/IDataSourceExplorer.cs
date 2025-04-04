using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Dm8Data.Source
{
    public interface IDataSourceExplorer 
    {
        public DataSources.DataSource Source { get; set; }
        public string Layer { get; set; }
        public string DataModule { get; set; }
        public string DataProduct { get; set; }
        public Task ConnectAsync(string connectionString);
        public Task<IList<Raw.ModelEntry>> QueryEntitiesAsync(string schemaFilter = null, string tableFilter = null);
        public Task<DateTime> RefreshAttributesAsync(Raw.ModelEntry selectedEntity, bool update = false);
    }
}
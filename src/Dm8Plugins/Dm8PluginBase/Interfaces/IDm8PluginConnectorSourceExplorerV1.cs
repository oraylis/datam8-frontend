/* DataM8
 * Copyright (C) 2024-2025 ORAYLIS GmbH
 *
 * This file is part of DataM8.
 *
 * DataM8 is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * DataM8 is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

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

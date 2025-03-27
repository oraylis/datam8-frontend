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

using Dm8Data.Plugins;
using Dm8PluginBase.Interfaces;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;

namespace Dm8Data.Source
{
    public class DataSourceExplorerFactory
    {
        static Dictionary<Type, Func<IDataSourceExplorer>> _factory = new Dictionary<Type, Func<IDataSourceExplorer>>();
        static List<IDm8PluginConnectorSourceExplorerV1> _plugins = new List<IDm8PluginConnectorSourceExplorerV1>();


        static DataSourceExplorerFactory()
        {
            _plugins = PluginHelper.LoadConnectors(Path.Combine(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location), "Plugins"), ".dll");

        }

        public static IDataSourceExplorer Create(Type t)
        {
            if (_factory.TryGetValue(t, out Func<IDataSourceExplorer> dataSourceExplorer))
            {
                return dataSourceExplorer.Invoke();
            }

            return null;
        }

        public static dynamic Create(string t)
        {
            IDm8PluginConnectorSourceExplorerV1 plugin = _plugins.Where(p => p.Name == t).FirstOrDefault();
            if (plugin != null)
            {
               return plugin;
            }
            else
            {
                var e = _factory.FirstOrDefault(k => k.Key.Name == t);
                if (e.Key != null)
                {
                    return e.Value.Invoke();
                }
            }

            return null;
        }

        public static List<IDm8PluginConnectorSourceExplorerV1> Plugins
        {
            get { return (_plugins); }
        }
    }
}

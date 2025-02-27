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

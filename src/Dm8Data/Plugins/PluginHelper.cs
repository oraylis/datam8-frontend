using Dm8PluginBase.Interfaces;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;

namespace Dm8Data.Plugins
{
    public static class PluginHelper
    {
        public static List<IDm8PluginConnectorSourceExplorerV1> LoadConnectors(string path, string extension)
        {
            List<IDm8PluginConnectorSourceExplorerV1> plugins = new List<IDm8PluginConnectorSourceExplorerV1>();

            if (Directory.Exists(path))
            {
                string[] files = Directory.GetFiles(path ,"*"+extension);
                foreach (string file in files)
                {
                    if (file.EndsWith(extension) && file.Contains("CSV") == false)
                    {
                        Assembly.LoadFile(Path.GetFullPath(file));
                    }
                }
            }

            Type interfaceType = typeof(IDm8PluginConnectorSourceExplorerV1);

            //Fetch all types that implement the interface and are a class
            Type[] types = AppDomain.CurrentDomain.GetAssemblies()
                .SelectMany(a => a.GetTypes())
                .Where(p => interfaceType.IsAssignableFrom(p) && p.IsClass) 
                .ToArray();

            foreach (Type type in types)
            {
                
                if (Activator.CreateInstance(type) is IDm8PluginConnectorSourceExplorerV1 inst)
                {
                    plugins.Add(inst);
                }
            }

            return (plugins);
        }

        public static bool IsConnectorPlugin(Type t)
        {
            bool retVal = t?.GetInterface(nameof(IDm8PluginConnectorSourceExplorerV1)) != null;
            return(retVal);
        }
    }
}

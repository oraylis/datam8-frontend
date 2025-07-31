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

using Oraylis.DataM8.PluginBase.Interfaces;
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
                    if (file.EndsWith(extension) && file.Contains("CSV") == false) //&& (file.Contains("Connector") || file.Contains("Oraylis")))
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

            foreach(Type type in types)
            {

                if(Activator.CreateInstance(type) is IDm8PluginConnectorSourceExplorerV1 inst)
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

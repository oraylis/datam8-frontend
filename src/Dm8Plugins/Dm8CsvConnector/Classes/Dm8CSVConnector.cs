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

using System.Collections.ObjectModel;
using Dm8CSVConnector.Views;
using Oraylis.DataM8.PluginBase.BaseClasses;
using Oraylis.DataM8.PluginBase.Interfaces;
using Extensions = Oraylis.DataM8.PluginBase.Extensions.Extensions;

#region Pragma
#pragma warning disable IDE0130
#pragma warning disable CS1998
#pragma warning disable CS8618
#pragma warning disable CS8602
#pragma warning disable CS8600
#endregion

namespace Dm8CSVConnector
{

   public class Dm8CSVConnector:IDm8PluginConnectorSourceExplorerV1
   {
      #region Properties
      public DataSourceBase Source { get; set; } = new DataSourceCSV();
      public string DataSourceName { get; set; }
      public string Name { get; private set; } = "CSVSource";
      public string Layer { get; set; }
      public string DataModule { get; set; }
      public string DataProduct { get; set; }
      #endregion

      public Dictionary<string ,string> DefaultDatatypes
      {
         get
         {
            Dictionary<string ,string> retVal = new Dictionary<string ,string>();
            retVal.Add("bit" ,"bit");
            retVal.Add("bigint" ,"long");
            retVal.Add("datetime" ,"datetime");
            retVal.Add("decimal" ,"decimal");
            retVal.Add("int" ,"int");
            retVal.Add("money" ,"money");
            retVal.Add("string" ,"string");
            return retVal;
         }
      }
      public async Task ConnectAsync(string connectionString)
      {
         this.Source.Connect(connectionString);
      }
      public bool ConfigureConnection(ref string conStr ,Dictionary<string ,string> extendedProperties)
      {
         bool retVal = false;
         var win = new ConfigureView();
         DataSourceCSV ds = (DataSourceCSV)this.Source;
         ds.ExtendedProperties = extendedProperties;
         ds.ConnectionString = conStr;

         foreach (KeyValuePair<string ,string> kv in this.DefaultDatatypes.OrderBy(x => x.Key))
         {
            win.Field_Type.Items.Add(kv.Key);
         }
         win.Source = ds;
         win.DataSourcename = this.DataSourceName;
         if (win.ShowDialog() == true)
         {
            conStr = ds.ConnectionString;
            extendedProperties = ds.ExtendedProperties;
            this.DataSourceName = win.DataSourcename;
            retVal = true;
         }

         return (retVal);
      }
      public async Task<DateTime> RefreshAttributesAsync<T, T1>(T sourceEntityIn ,T1 elementsIn ,bool update = false)
      {
         RawModelEntryBase sourceEntity = sourceEntityIn as RawModelEntryBase;
         ObservableCollection<RawAttributBase> elements = elementsIn as ObservableCollection<RawAttributBase>;
         DateTime now = DateTime.UtcNow;

         DataSourceCSV source = Extensions.ConvertClass<DataSourceCSV ,DataSourceBase>(this.Source);
         source.RealConnectionString = true;
         source.Connect(source.ConnectionString);

         source.RealConnectionString = false;
         return now;
      }
      public async Task<IList<RawModelEntryBase>> SelectObjects(Func<string ,bool> addFile)
      {
         IList<RawModelEntryBase> retVal = new List<RawModelEntryBase>();
         DataSourceCSV source = Extensions.ConvertClass<DataSourceCSV ,DataSourceBase>(this.Source);
         source.RealConnectionString = true;
         source.Connect(source.ConnectionString);
         return (retVal);
      }

   }
}

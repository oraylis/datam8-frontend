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

using System.IO;
using System.Windows;
using DuckDB.NET.Data;
using Oraylis.DataM8.PluginBase.BaseClasses;

namespace Dm8DuckDbConnector.Classes
{
#pragma warning disable CS8600
#pragma warning disable CS8601
#pragma warning disable CS8603

   public class DataSourceDuckDb:DataSourceBase
   {
      private string _connectionString = "";
      public string FilePath = "";

      public DataSourceDuckDb()
      {
         this.Name = "DuckDbSource";
      }

      public new string ConnectionString
      {
         get
         {
            if (string.IsNullOrEmpty(FilePath))
            {
               return "";
            }
            return $"Data Source={FilePath};";
         }
         set
         {
            _connectionString = value;
            this.FilePath = GetConnectionProperty(_connectionString ,"Data Source");
            if (string.IsNullOrEmpty(this.FilePath))
            {
               // Try alternative format
               this.FilePath = GetConnectionProperty(_connectionString ,"Filename");
            }
         }
      }

      public new bool Validate(bool showMessage)
      {
         bool retVal = false;

         try
         {
            if (string.IsNullOrEmpty(FilePath))
            {
               if (showMessage)
               {
                  MessageBox.Show("Please select a DuckDB file." ,$@"Connection: {this.Name}");
               }
               return false;
            }

            if (!File.Exists(FilePath))
            {
               if (showMessage)
               {
                  MessageBox.Show("DuckDB file not found." ,$@"Connection: {this.Name}");
               }
               return false;
            }

            // Test connection
            using (var connection = new DuckDBConnection(ConnectionString))
            {
               connection.Open();
               connection.Close();
            }

            if (showMessage)
            {
               MessageBox.Show("Connection established" ,$@"Connection: {this.Name}");
            }

            retVal = true;
         }
         catch (Exception ex)
         {
            if (showMessage)
            {
               MessageBox.Show(ex.Message ,$@"Connection: {this.Name}");
            }
         }
         this.RealConnectionString = false;
         return retVal;
      }

      public new bool Connect(string conStr)
      {
         bool retVal = true;
         return retVal;
      }

      private string GetConnectionProperty(string conStr ,string key)
      {
         string retVal = "";

         try
         {
            if (string.IsNullOrEmpty(conStr))
            {
               return retVal;
            }

            Dictionary<string ,string> dictionaryConnectionProperties = conStr.TrimEnd(';').Split(';')
                .Where(item => item.Contains('='))
                .ToDictionary(
                    item => item.Split('=' ,2)[0].Trim() ,
                    item => item.Split('=' ,2)[1].Trim() ,
                    StringComparer.OrdinalIgnoreCase);

            if (dictionaryConnectionProperties.TryGetValue(key ,out string? value))
            {
               retVal = value;
            }
         }
         catch
         {
            // Ignore parsing errors
         }

         return retVal;
      }
   }
}


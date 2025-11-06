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
using System.Data;
using Dm8DuckDbConnector.Classes;
using Dm8DuckDbConnector.Views;
using DuckDB.NET.Data;
using Oraylis.DataM8.PluginBase.BaseClasses;
using Oraylis.DataM8.PluginBase.Extensions;
using Oraylis.DataM8.PluginBase.Interfaces;

namespace Dm8DuckDbConnector
{
   #region Pragma
#pragma warning disable CS8604
#pragma warning disable CS8602
#pragma warning disable CS8618
#pragma warning disable CS8601
#pragma warning disable CS8625
#pragma warning disable CS8602 // Dereference of a possibly null reference.
#pragma warning disable CS8600 // Converting null literal or possible null value to non-nullable type.
   #endregion

   public class DuckDbConnector:IDm8PluginConnectorSourceExplorerV1
   {
      #region Const
      private const string TABLE_NAME = "table_name";
      private const string TABLE_SCHEMA = "table_schema";
      private const string TABLE_TYPE = "table_type";
      private const string COLUMN_NAME = "column_name";
      private const string ORDINAL_POSITION = "ordinal_position";
      private const string IS_NULLABLE = "is_nullable";
      private const string DATA_TYPE = "data_type";
      private const string CHARACTER_MAXIMUM_LENGTH = "character_maximum_length";
      private const string NUMERIC_PRECISION = "numeric_precision";
      private const string NUMERIC_SCALE = "numeric_scale";
      #endregion

      #region Properties
      public DataSourceBase Source { get; set; } = new DataSourceDuckDb();
      public string DataSourceName { get; set; }
      public string Name { get; private set; } = "DuckDbSource";
      public string Layer { get; set; }
      public string DataModule { get; set; }
      public string DataProduct { get; set; }
      #endregion

      public Dictionary<string ,string> DefaultDatatypes
      {
         get
         {
            Dictionary<string ,string> retVal = new Dictionary<string ,string>();
            retVal.Add("BOOLEAN" ,"bit");
            retVal.Add("TINYINT" ,"byte");
            retVal.Add("SMALLINT" ,"short");
            retVal.Add("INTEGER" ,"int");
            retVal.Add("BIGINT" ,"long");
            retVal.Add("UTINYINT" ,"byte");
            retVal.Add("USMALLINT" ,"short");
            retVal.Add("UINTEGER" ,"int");
            retVal.Add("UBIGINT" ,"long");
            retVal.Add("FLOAT" ,"double");
            retVal.Add("DOUBLE" ,"double");
            retVal.Add("DECIMAL" ,"decimal");
            retVal.Add("DATE" ,"datetime");
            retVal.Add("TIME" ,"datetime");
            retVal.Add("TIMESTAMP" ,"datetime");
            retVal.Add("TIMESTAMP WITH TIME ZONE" ,"datetime");
            retVal.Add("INTERVAL" ,"string");
            retVal.Add("VARCHAR" ,"string");
            retVal.Add("CHAR" ,"string");
            retVal.Add("BLOB" ,"binary");
            retVal.Add("BIT" ,"binary");
            retVal.Add("UUID" ,"uniqueidentifier");
            retVal.Add("JSON" ,"string");
            retVal.Add("LIST" ,"string");
            retVal.Add("STRUCT" ,"string");
            retVal.Add("MAP" ,"string");
            return retVal;
         }
      }

      public async Task ConnectAsync(string connectionString)
      {
         DataSourceDuckDb source = Extensions.ConvertClass<DataSourceDuckDb ,DataSourceBase>(this.Source);
         source.RealConnectionString = true;
         using (DuckDBConnection connection = new DuckDBConnection(source.ConnectionString))
         {
            await connection.OpenAsync();
         }
      }

      public async Task<DateTime> RefreshAttributesAsync<T, T1>(T sourceEntityIn ,T1 elementsIn ,bool update = false)
      {
         RawModelEntryBase sourceEntity = sourceEntityIn as RawModelEntryBase;
         ObservableCollection<RawAttributBase> elements = elementsIn as ObservableCollection<RawAttributBase>;
         DateTime now = DateTime.UtcNow;

         DataSourceDuckDb source = Extensions.ConvertClass<DataSourceDuckDb ,DataSourceBase>(this.Source);
         source.RealConnectionString = true;

         // Refresh from database
         using (DuckDBConnection connection = new DuckDBConnection(source.ConnectionString))
         {
            source.RealConnectionString = false;
            await connection.OpenAsync();

            string tableName = sourceEntity.Function.SourceLocation;
            // Remove schema prefix if present (DuckDB uses simple table names or schema.table format)
            if (tableName.Contains('.'))
            {
               tableName = tableName.Split('.').Last().Trim('[', ']');
            }
            else
            {
               tableName = tableName.Trim('[', ']');
            }

            string query = $@"
                SELECT 
                    column_name,
                    data_type,
                    character_maximum_length,
                    numeric_precision,
                    numeric_scale,
                    is_nullable,
                    ordinal_position
                FROM information_schema.columns
                WHERE table_name = '{tableName}'
                ORDER BY ordinal_position";

            var columns = new List<RawAttributBase>();
            using (var command = connection.CreateCommand())
            {
               command.CommandText = query;
               using (var reader = await command.ExecuteReaderAsync())
               {
                  while (await reader.ReadAsync())
                  {
                     var rec = new RawAttributBase()
                     {
                        Name = reader.GetString(0) ,
                        Type = reader.GetString(1) ,
                        CharLength = reader.IsDBNull(2) ? null : reader.GetInt32(2) ,
                        Precision = reader.IsDBNull(3) ? null : reader.GetInt32(3) ,
                        Scale = reader.IsDBNull(4) ? null : reader.GetInt32(4) ,
                        Nullable = reader.GetString(5).Equals("YES" ,StringComparison.OrdinalIgnoreCase) ,
                        DateModified = null ,
                        DateDeleted = null ,
                        DateAdded = null
                     };
                     columns.Add(rec);
                  }
               }
            }

            bool isNew = (elements == null || elements.Count == 0);
            var rc = new ObservableCollection<RawAttributBase>(columns);

            if (isNew)
            {
               foreach (var col in rc)
               {
                  col.DateAdded = now.ToString("yyyy-MM-dd HH:mm:ss");
               }
               elements = rc;
            }
            else
            {
               foreach (var attr in elements)
               {
                  var newAttr = rc.FirstOrDefault(a => a.Name == attr.Name);
                  if (newAttr == null)
                  {
                     if (attr.DateDeleted == null)
                     {
                        // attr does not exist anymore
                        attr.DateDeleted = now.ToString("yyyy-MM-dd HH:mm:ss");
                     }
                  }
                  else if (update)
                  {
                     if (attr.Type != newAttr?.Type ||
                         attr.CharLength != newAttr.CharLength ||
                         attr.Precision != newAttr.Precision ||
                         attr.Scale != newAttr.Scale ||
                         attr.Nullable != newAttr.Nullable)
                     {
                        attr.Type = newAttr.Type;
                        attr.CharLength = newAttr.CharLength;
                        attr.Precision = newAttr.Precision;
                        attr.Scale = newAttr.Scale;
                        attr.Nullable = newAttr.Nullable;
                        attr.DateModified = now.ToString("yyyy-MM-dd HH:mm:ss");
                     }
                  }
               }

               foreach (var attr in rc)
               {
                  var currentAttr = elements.FirstOrDefault(a => a.Name == attr.Name);
                  if (currentAttr == null)
                  {
                     attr.DateAdded = now.ToString("yyyy-MM-dd HH:mm:ss");
                     elements.Add(attr);
                  }
               }
            }
            connection.Close();
         }
         source.RealConnectionString = false;

         return now;
      }

      public bool ConfigureConnection(ref string conStr ,Dictionary<string ,string> extendedProperties)
      {
         bool retVal = false;
         var win = new ConfigureView();
         if (!String.IsNullOrEmpty(conStr))
         {
            DataSourceDuckDb ds = new DataSourceDuckDb
            {
               ExtendedProperties = extendedProperties ,
               ConnectionString = conStr
            };
            win.Source = ds;
         }

         win.DataSourcename = this.DataSourceName;
         if (win.ShowDialog() == true)
         {
            conStr = win.Source.ConnectionString;
            extendedProperties = win.Source.ExtendedProperties;
            this.DataSourceName = win.DataSourcename;
            retVal = true;
         }

         return (retVal);
      }

      public async Task<IList<RawModelEntryBase>> SelectObjects(Func<string ,bool> addFile)
      {
         IList<RawModelEntryBase> retVal = new List<RawModelEntryBase>();
         DataSourceDuckDb source = Extensions.ConvertClass<DataSourceDuckDb ,DataSourceBase>(this.Source);
         source.RealConnectionString = true;

         using (DuckDBConnection connection = new DuckDBConnection(source.ConnectionString))
         {
            source.RealConnectionString = false;
            await connection.OpenAsync();

            // Query all tables and views from DuckDB
            string query = @"
                SELECT 
                    table_schema,
                    table_name,
                    table_type
                FROM information_schema.tables
                WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'temp')
                ORDER BY table_schema, table_name";

            var tables = new List<RawModelEntryBase>();
            using (var command = connection.CreateCommand())
            {
               command.CommandText = query;
               using (var reader = await command.ExecuteReaderAsync())
               {
                  while (await reader.ReadAsync())
                  {
                     string schemaName = reader.IsDBNull(0) ? "main" : reader.GetString(0);
                     string tableName = reader.GetString(1);
                     string objectType = reader.GetString(2);

                     string schema = schemaName.Replace(" " ,"_");
                     string name = tableName.Replace(" " ,"_");

                     RawModelEntryBase me = new RawModelEntryBase()
                     {
                        Type = "raw" ,
                        Entity = new RawEntityBase()
                        {
                           DataModule = this.DataModule ,
                           DataProduct = this.DataProduct ,
                           Name = tableName ,
                           DisplayName = tableName.FromCamelCase() ,
                           ObjectType = objectType.Equals("BASE TABLE" ,StringComparison.OrdinalIgnoreCase) ? "Table" : "View"
                        } ,
                        Schema = schemaName ,
                        Function = new RawFunctionBase()
                        {
                           DataSource = this.Source.Name ,
                           SourceLocation = $"{schemaName}.{tableName}"
                        }
                     };
                     if (addFile(me.Entity.Dm8l))
                     {
                        tables.Add(me);
                     }
                  }
               }
            }

            SelectObjects so = new SelectObjects
            {
               Entities = tables ,
               Title = "Select DuckDB Objects"
            };
            if (so.ShowDialog() == true)
            {
               retVal = so.Entities;
               DateTime now = DateTime.UtcNow;
               bool update = true;

               foreach (var sourceEntity in retVal)
               {
                  string tableName = sourceEntity.Function.SourceLocation;
                  if (tableName.Contains('.'))
                  {
                     tableName = tableName.Split('.').Last();
                  }

                  string columnQuery = $@"
                      SELECT 
                          column_name,
                          data_type,
                          character_maximum_length,
                          numeric_precision,
                          numeric_scale,
                          is_nullable,
                          ordinal_position
                      FROM information_schema.columns
                      WHERE table_name = '{tableName}'
                      ORDER BY ordinal_position";

                  var rc2 = new ObservableCollection<RawAttributBase>();
                  bool isNew = sourceEntity?.Entity?.Attribute == null || sourceEntity?.Entity?.Attribute?.Count == 0;

                  using (var columnCommand = connection.CreateCommand())
                  {
                     columnCommand.CommandText = columnQuery;
                     using (var columnReader = await columnCommand.ExecuteReaderAsync())
                     {
                        while (await columnReader.ReadAsync())
                        {
                           var rec = new RawAttributBase()
                           {
                              Name = columnReader.GetString(0) ,
                              Type = columnReader.GetString(1) ,
                              CharLength = columnReader.IsDBNull(2) ? null : columnReader.GetInt32(2) ,
                              Precision = columnReader.IsDBNull(3) ? null : columnReader.GetInt32(3) ,
                              Scale = columnReader.IsDBNull(4) ? null : columnReader.GetInt32(4) ,
                              Nullable = columnReader.GetString(5).Equals("YES" ,StringComparison.OrdinalIgnoreCase) ,
                              DateAdded = null ,
                              DateDeleted = null ,
                              DateModified = null
                           };

                           if (isNew)
                           {
                              rec.DateAdded = now.ToString("yyyy-MM-dd HH:mm:ss");
                           }
                           rc2.Add(rec);
                        }
                     }
                  }

                  if (isNew)
                  {
                     sourceEntity.Entity.Attribute = rc2;
                  }
                  else
                  {
                     foreach (var attr in sourceEntity.Entity.Attribute)
                     {
                        var newAttr = rc2.FirstOrDefault(a => a.Name == attr.Name);
                        if (newAttr == null)
                        {
                           if (attr.DateDeleted == null)
                           {
                              // attr does not exist anymore
                              attr.DateDeleted = now.ToString("yyyy-MM-dd HH:mm:ss");
                           }
                        }
                        else if (update)
                        {
                           if (attr.Type != newAttr.Type ||
                               attr.CharLength != newAttr.CharLength ||
                               attr.Precision != newAttr.Precision ||
                               attr.Scale != newAttr.Scale ||
                               attr.Nullable != newAttr.Nullable)
                           {
                              attr.Type = newAttr.Type;
                              attr.CharLength = newAttr.CharLength;
                              attr.Precision = newAttr.Precision;
                              attr.Scale = newAttr.Scale;
                              attr.Nullable = newAttr.Nullable;
                              attr.DateModified = now.ToString("yyyy-MM-dd HH:mm:ss");
                           }
                        }
                     }

                     foreach (var attr in rc2)
                     {
                        var currentAttr = sourceEntity.Entity.Attribute.FirstOrDefault(a => a.Name == attr.Name);
                        if (currentAttr == null)
                        {
                           // attr does not exist 
                           attr.DateAdded = now.ToString("yyyy-MM-dd HH:mm:ss");
                           sourceEntity.Entity.Attribute.Add(attr);
                        }
                     }
                  }
               }
            }
            source.RealConnectionString = false;
            connection.Close();
         }
         return (retVal);
      }
   }
}


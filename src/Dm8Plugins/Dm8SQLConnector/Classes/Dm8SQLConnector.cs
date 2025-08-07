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
using System.Text;
using Dm8LakeConnector.Views;
using Microsoft.Data.SqlClient;
using Oraylis.DataM8.PluginBase.BaseClasses;
using Oraylis.DataM8.PluginBase.Extensions;
using Oraylis.DataM8.PluginBase.Interfaces;

namespace Dm8LakeConnector
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

   public class Dm8SQLConnector:IDm8PluginConnectorSourceExplorerV1
   {
      #region Const
      private const string TABLE_SCHEMA = "TABLE_SCHEMA";
      private const string TABLE_TYPE = "TABLE_TYPE";
      private const string TABLE_NAME = "TABLE_NAME";
      private const string COLUMN_NAME = "COLUMN_NAME";
      private const string ORDINAL_POSITION = "ORDINAL_POSITION";
      private const string IS_NULLABLE = "IS_NULLABLE";
      private const string DATA_TYPE = "DATA_TYPE";
      private const string CHARACTER_MAXIMUM_LENGTH = "CHARACTER_MAXIMUM_LENGTH";
      private const string NUMERIC_PRECISION = "NUMERIC_PRECISION";
      private const string NUMERIC_SCALE = "NUMERIC_SCALE";
      #endregion

      #region Properties
      public DataSourceBase Source { get; set; } = new DataSourceSql();
      public string DataSourceName { get; set; }
      public string Name { get; private set; } = "SqlDataSource";
      public string Layer { get; set; }
      public string DataModule { get; set; }
      public string DataProduct { get; set; }
      #endregion

      public Dictionary<string ,string> DefaultDatatypes
      {
         get
         {
            Dictionary<string ,string> retVal = new Dictionary<string ,string>();
            retVal.Add("bigint" ,"long");
            retVal.Add("binary" ,"binary");
            retVal.Add("bit" ,"bit");
            retVal.Add("char" ,"string");
            retVal.Add("date" ,"datetime");
            retVal.Add("datetime" ,"datetime");
            retVal.Add("datetime2" ,"datetime");
            retVal.Add("datetimeoffset" ,"datetime");
            retVal.Add("decimal" ,"decimal");
            retVal.Add("float" ,"double");
            retVal.Add("geography" ,"string");
            retVal.Add("geometry" ,"binary");
            retVal.Add("hierarchyid" ,"string");
            retVal.Add("image" ,"binary");
            retVal.Add("int" ,"int");
            retVal.Add("money" ,"money");
            retVal.Add("nchar" ,"string");
            retVal.Add("ntext" ,"string");
            retVal.Add("numeric" ,"decimal");
            retVal.Add("nvarchar" ,"string");
            retVal.Add("real" ,"double");
            retVal.Add("smalldatetime" ,"datetime");
            retVal.Add("smallint" ,"short");
            retVal.Add("smallmoney" ,"money");
            retVal.Add("sql_variant" ,"binary");
            retVal.Add("sysname" ,"string");
            retVal.Add("text" ,"string");
            retVal.Add("time" ,"datetime");
            retVal.Add("timestamp" ,"binary");
            retVal.Add("tinyint" ,"byte");
            retVal.Add("uniqueidentifier" ,"uniqueidentifier");
            retVal.Add("varbinary" ,"binary");
            retVal.Add("varchar" ,"string");
            retVal.Add("xml" ,"string");
            return (retVal);
         }
      }

      private static string GetSchemaName(string v)
      {
         var comps = v.Split('.');
         if (comps[0].StartsWith("["))
         {
            return comps[0].Substring(1 ,comps[0].Length - 2);
         } else
         {
            return comps[0];
         }
      }

      private static string? GetTableName(string v)
      {
         var comps = v.Split('.');
         if (comps.Length < 2)
            return null;

         if (comps[1].StartsWith("["))
         {
            return comps[1].Substring(1 ,comps[1].Length - 2);
         } else
         {
            return comps[1];
         }
      }

      private static string ToNameSql(string str)
      {
         StringBuilder sb = new StringBuilder();
         foreach (var c in str)
         {
            if (((c >= 'A' && c <= 'Z') || c >= 'a' && c <= 'z' || c >= '0' && c <= '9') || c == '$')
               sb.Append(c);
            else
               sb.Append('_');
         }

         return sb.ToString();
      }

      public async Task ConnectAsync(string connectionString)
      {
         using (SqlConnection sqlConnection = new SqlConnection(connectionString))
         {
            await sqlConnection.OpenAsync();
         }
      }

      public async Task<DateTime> RefreshAttributesAsync(RawModelEntryBase sourceEntity ,bool update = false)
      {
         DateTime now = DateTime.UtcNow;

         DataSourceSql source = Extensions.ConvertClass<DataSourceSql ,DataSourceBase>(this.Source);
         source.RealConnectionString = true;

         // refesh fom database
         using (SqlConnection sqlConnection = new SqlConnection(source.ConnectionString))
         {
            source.RealConnectionString = false;
            await sqlConnection.OpenAsync();
            var tables = await sqlConnection.GetSchemaAsync("Columns" ,
                new string[]
                {
                        null, Dm8SQLConnector.GetSchemaName(sourceEntity.Function.SourceLocation),
                        Dm8SQLConnector.GetTableName(sourceEntity.Function.SourceLocation), null
                });
            var rc = new ObservableCollection<RawAttributBase>();
            foreach (var col in tables.Rows.OfType<DataRow>().OrderBy(r => r.Field<int>(ORDINAL_POSITION)))
            {
               rc.Add(new RawAttributBase()
               {
                  Name = col.Field<string>(COLUMN_NAME) ,
                  Type = col.Field<string>(DATA_TYPE) ,
                  CharLength = col.GetInt(CHARACTER_MAXIMUM_LENGTH) >= 0 ? col.GetInt(CHARACTER_MAXIMUM_LENGTH) : null ,
                  Precision = col.GetInt(NUMERIC_PRECISION) >= 0 ? col.GetInt(NUMERIC_PRECISION) : null ,
                  Scale = col.GetInt(NUMERIC_SCALE) >= 0 ? col.GetInt(NUMERIC_SCALE) : null ,
                  Nullable = col.Field<string>(IS_NULLABLE) == "YES" ,
                  DateModified = now.ToString("yyyy-MM-dd HH:mm:ss") ,
                  DateDeleted = null
               });
            }

            if (sourceEntity?.Entity?.Attribute == null)
            {
               sourceEntity.Entity.Attribute = rc;
            } else
            {
               foreach (var attr in sourceEntity.Entity.Attribute)
               {
                  var newAttr = rc.FirstOrDefault(a => a.Name == attr.Name);
                  if (newAttr == null && attr.DateDeleted == null)
                  {
                     // attr does not exist anymore
                     attr.DateDeleted = now.ToString("yyyy-MM-dd HH:mm:ss");
                  } else if (update)
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
                  var currentAttr = sourceEntity.Entity.Attribute.FirstOrDefault(a => a.Name == attr.Name);
                  if (currentAttr == null)
                  {
                     sourceEntity.Entity.Attribute.Add(attr);
                  }
               }
            }
            sqlConnection.Close();
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
            DataSourceSql ds = new DataSourceSql
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
         DataSourceSql source = Extensions.ConvertClass<DataSourceSql ,DataSourceBase>(this.Source);
         source.RealConnectionString = true;

         using (SqlConnection sqlConnection = new SqlConnection(source.ConnectionString))
         {
            source.RealConnectionString = false;
            await sqlConnection.OpenAsync();

            var tables = await sqlConnection.GetSchemaAsync("Tables");
            var rc1 = new List<RawModelEntryBase>();
            foreach (var table in tables.Rows.OfType<DataRow>())
            {
               string tableName = table.Field<string>(TABLE_NAME);
               string schemaName = table.Field<string>(TABLE_SCHEMA);
               string objectType = table.Field<string>(TABLE_TYPE);
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
                     ObjectType = (bool)(objectType == "BASE TABLE") ? "Table" : "View"
                  } ,
                  Schema = schemaName ,
                  Function = new RawFunctionBase()
                  {
                     DataSource = this.Source.Name ,
                     SourceLocation =
                           $"[{schemaName}].[{tableName}]"
                  }
               };
               if (addFile(me.Entity.Dm8l))
               {
                  rc1.Add(me);
               }
            }
            SelectObjects so = new SelectObjects
            {
               Entities = rc1 ,
               Title = "Select Objects"
            };
            if (so.ShowDialog() == true)
            {
               retVal = so.Entities;
               DateTime now = DateTime.UtcNow;
               bool update = true;

               foreach (var sourceEntity in retVal)
               {
                  tables = await sqlConnection.GetSchemaAsync("Columns" ,
                      new string[]
                      {
                                null, Dm8SQLConnector.GetSchemaName(sourceEntity.Function.SourceLocation),
                                Dm8SQLConnector.GetTableName(sourceEntity.Function.SourceLocation), null
                      });
                  var rc2 = new ObservableCollection<RawAttributBase>();
                  foreach (var col in tables.Rows.OfType<DataRow>().OrderBy(r => r.Field<int>(ORDINAL_POSITION)))
                  {
                     rc2.Add(new RawAttributBase()
                     {
                        Name = col.Field<string>(COLUMN_NAME) ,
                        Type = col.Field<string>(DATA_TYPE) ,
                        CharLength = col.GetInt(CHARACTER_MAXIMUM_LENGTH) >= 0 ? col.GetInt(CHARACTER_MAXIMUM_LENGTH) : null ,
                        Precision = col.GetInt(NUMERIC_PRECISION) >= 0 ? col.GetInt(NUMERIC_PRECISION) : null ,
                        Scale = col.GetInt(NUMERIC_SCALE) >= 0 ? col.GetInt(NUMERIC_SCALE) : null ,
                        Nullable = col.Field<string>(IS_NULLABLE) == "YES" ,
                        DateModified = now.ToString("yyyy-MM-dd HH:mm:ss") ,
                        DateDeleted = null
                     });
                  }

                  if (sourceEntity?.Entity?.Attribute == null)
                  {
                     sourceEntity.Entity.Attribute = rc2;
                  } else
                  {
                     foreach (var attr in sourceEntity.Entity.Attribute)
                     {
                        var newAttr = rc2.FirstOrDefault(a => a.Name == attr.Name);
                        if (newAttr == null && attr.DateDeleted == null)
                        {
                           // attr does not exist anymore
                           attr.DateDeleted = now.ToString("yyyy-MM-dd HH:mm:ss");
                        } else if (update)
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
                           // attr does not exist anymore
                           sourceEntity.Entity.Attribute.Add(attr);
                        }
                     }
                  }
               }
            }
            source.RealConnectionString = false;
            sqlConnection.Close();
         }
         return (retVal);
      }
   }
}

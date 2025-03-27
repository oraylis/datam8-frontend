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
using Dm8PluginBase.Extensions;
using Dm8PluginBase.Interfaces;
using Microsoft.Data.SqlClient;
using System.Collections.ObjectModel;
using System.Data;
using System.Text;
using Dm8OracleConnector.Views;
using Oracle.ManagedDataAccess.Client;
using System.Runtime.CompilerServices;
using System.IO;
using System.Data.Common;

#pragma warning disable IDE0079 // Remove unnecessary suppression
#pragma warning disable CS8629 // Nullable value type may be null.
#pragma warning disable CS8600 // Nullable value type may be null.
#pragma warning disable CS8601 // Nullable value type may be null.
#pragma warning disable IDE0130 // Namespace does not match folder structure
#pragma warning disable IDE0090
#pragma warning disable IDE0028
#pragma warning disable IDE0059
#pragma warning disable IDE0060
#pragma warning disable IDE0063
#pragma warning disable IDE1006
#pragma warning disable CA1822 // Mark members as static
#pragma warning disable IDE0057 // Use range operator

namespace Dm8OracleConnector
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

    public class Dm8OracleConnector : IDm8PluginConnectorSourceExplorerV1
    {
        #region Const
        private const string COLUMN_NAME = "COLUMN_NAME";
        #endregion

        #region Properties
        public DataSourceBase Source { get; set; } = new DataSourceOracle();
        public string DataSourceName { get; set; }
        public string Name { get; private set; } = "OracleDataSource";
        public string Layer { get; set; }
        public string DataModule { get; set; }
        public string DataProduct { get; set; }
        #endregion

        public Dictionary<string, string> DefaultDatatypes
        {
            get
            {
                Dictionary<string, string> retVal = new Dictionary<string, string>();
                retVal.Add("array", "binary");
                retVal.Add("blob", "binary");
                retVal.Add("char", "string");
                retVal.Add("clob", "binary");
                retVal.Add("date", "datetime");
                retVal.Add("float", "double");
                retVal.Add("intervalds", "int");
                retVal.Add("intervalym", "int");
                retVal.Add("long", "long");
                retVal.Add("nchar", "string");
                retVal.Add("nclob", "binary");
                retVal.Add("number", "long");
                retVal.Add("nvarchar2", "string");
                retVal.Add("raw", "binary");
                retVal.Add("real", "double");
                retVal.Add("ref", "binary");
                retVal.Add("struct", "binary");
                retVal.Add("timestamp", "binary");
                retVal.Add("varchar2", "string");
                return (retVal);
            }
        }

        private static string GetSchemaName(string v)
        {
            var comps = v.Split('.');
            if (comps[0].StartsWith('['))
            {
                return comps[0].Substring(1, comps[0].Length - 2);
            }
            else
            {
                return comps[0];
            }
        }

        private static string? GetTableName(string v)
        {
            var comps = v.Split('.');
            if (comps.Length < 2)
                return null;

            if (comps[1].StartsWith('['))
            {
                return comps[1].Substring(1, comps[1].Length - 2);
            }
            else
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

        private static string FixDataType(string str)
        {
            if (str.Contains('('))
            {
                str = str.Substring(0, str.IndexOf('('));
            }
            if (str.Contains(' '))
            {
                str = str.Substring(0, str.IndexOf(' '));
            }
            return str;
        }

        public async Task ConnectAsync(string connectionString)
        {
            using (OracleConnection sqlConnection = new OracleConnection(connectionString))
            {
                DataSourceOracle source = Extensions.ConvertClass<DataSourceOracle, DataSourceBase>(this.Source);
                sqlConnection.SetVersion(source.ProtocolVersion);
                await sqlConnection.OpenAsync();
            }
        }

        public async Task<DateTime> RefreshAttributesAsync(RawModelEntryBase sourceEntity, bool update = false)
        {
            DateTime now = DateTime.UtcNow;

            DataSourceOracle source = Extensions.ConvertClass<DataSourceOracle, DataSourceBase>(this.Source);
            source.RealConnectionString = true;

            // refesh fom database
            using (OracleConnection sqlConnection = new OracleConnection(source.ConnectionString))
            {
                sqlConnection.SetVersion(source.ProtocolVersion);
                source.RealConnectionString = false;
                await sqlConnection.OpenAsync();
                string[] restrictions = new string[3];
                for (int i = 0; i < 3; i++)
                {
                    restrictions[i] = null;
                }

                restrictions[0] = Dm8OracleConnector.GetSchemaName(sourceEntity.Function.SourceLocation);
                restrictions[1] = Dm8OracleConnector.GetTableName(sourceEntity.Function.SourceLocation);

                var tables = await sqlConnection.GetSchemaAsync("Columns", restrictions);
                var rc = new ObservableCollection<RawAttributBase>();
                foreach (var col in tables.Rows.OfType<DataRow>().OrderBy(r => r.Field<decimal>("ID")))
                {
                    rc.Add(new RawAttributBase()
                    {
                        Name = Dm8OracleConnector.ToNameSql(col.Field<string>(COLUMN_NAME)),
                        Type = Dm8OracleConnector.FixDataType(col.Field<string>("DATATYPE")),
                        CharLength = col.GetInt("LENGTH") >= 0 ? col.GetInt("LENGTH") : null,
                        Precision = col.GetInt("PRECISION") >= 0 ? col.GetInt("PRECISION") : null,
                        Scale = col.GetInt("SCALE") >= 0 ? col.GetInt("SCALE") : null,
                        Nullable = col.Field<string>("NULLABLE") == "Y",
                        DateModified = now.ToString("yyyy-MM-dd HH:mm:ss"),
                        DateDeleted = null
                    });
                }

                if (sourceEntity?.Entity?.Attribute == null)
                {
                    sourceEntity.Entity.Attribute = rc;
                }
                else
                {
                    foreach (var attr in sourceEntity.Entity.Attribute)
                    {
                        var newAttr = rc.FirstOrDefault(a => a.Name == attr.Name);
                        if (newAttr == null && attr.DateDeleted == null)
                        {
                            // attr does not exist anymore
                            attr.DateDeleted = now.ToString("yyyy-MM-dd HH:mm:ss");
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

        public bool ConfigureConnection(ref string conStr, Dictionary<string, string> extendedProperties)
        {
            bool retVal = false;
            var win = new ConfigureView();
            if (!String.IsNullOrEmpty(conStr))
            {
                DataSourceOracle ds = new DataSourceOracle
                {
                    ExtendedProperties = extendedProperties,
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

        public async Task<IList<RawModelEntryBase>> SelectObjects(Func<string, bool> addFile)
        {
            IList<RawModelEntryBase> retVal = new List<RawModelEntryBase>();
            DataSourceOracle source = Extensions.ConvertClass<DataSourceOracle, DataSourceBase>(this.Source);
            source.RealConnectionString = true;

            using (OracleConnection sqlConnection = new OracleConnection(source.ConnectionString))
            {
                sqlConnection.SetVersion(source.ProtocolVersion);
                source.RealConnectionString = false;
                await sqlConnection.OpenAsync();

                var rc1 = new List<RawModelEntryBase>();

                var tables = await sqlConnection.GetSchemaAsync("Tables");
                foreach (var table1 in tables.Rows.OfType<DataRow>())
                {
                    string tableName = table1.Field<string>(1);
                    string schemaName = table1.Field<string>(0);
                    string objectType = "Table"; // table1.Field<string>(2);
                    string schema = schemaName.Replace(" ", "_");
                    string name = tableName.Replace(" ", "_");

                    if (Dm8OracleConnector.ValidSchema(schemaName))
                    {
                        try
                        {
                            RawModelEntryBase me = new RawModelEntryBase()
                            {
                                Type = "raw",
                                Entity = new RawEntityBase()
                                {
                                    DataModule = this.DataModule,
                                    DataProduct = this.DataProduct,
                                    Name = tableName,
                                    DisplayName = tableName.FromCamelCase(),
                                    ObjectType = objectType
                                },
                                Schema = schemaName,
                                Function = new RawFunctionBase()
                                {
                                    DataSource = this.Source.Name,
                                    SourceLocation =
                                        $"{schemaName}.{tableName}"
                                }
                            };
                            if (addFile(me.Entity.Dm8l))
                            {
                                rc1.Add(me);
                            }
                        }
                        catch { }
                    }
                }

                tables = await sqlConnection.GetSchemaAsync("Views");
                foreach (var table2 in tables.Rows.OfType<DataRow>())
                {
                    try
                    {
                        var schemaName = table2.Field<object>(0).ToString();
                        var tableName = table2.Field<object>(1).ToString();
                        var objectType = "View"; // table2.Field<object>(2).ToString();
                        var schema = schemaName.Replace(" ", "_");
                        var name = tableName.Replace(" ", "_");

                        if (Dm8OracleConnector.ValidSchema(schemaName))
                        {
                            try
                            {
                                RawModelEntryBase me = new RawModelEntryBase()
                                {
                                    Type = "raw",
                                    Entity = new RawEntityBase()
                                    {
                                        DataModule = this.DataModule,
                                        DataProduct = this.DataProduct,
                                        Name = tableName,
                                        DisplayName = tableName.FromCamelCase(),
                                        ObjectType = objectType
                                    },
                                    Schema = schemaName,
                                    Function = new RawFunctionBase()
                                    {
                                        DataSource = this.Source.Name,
                                        SourceLocation =
                                            $"{schemaName}.{tableName}"
                                    }
                                };
                                if (addFile(me.Entity.Dm8l))
                                {
                                    rc1.Add(me);
                                }
                            }
                            catch { }
                        }
                    }
                    catch { }
                }
                SelectObjects so = new SelectObjects
                {
                    Entities = rc1,
                    Title = "Select Objects"
                };
                if (so.ShowDialog() == true)
                {
                    retVal = so.Entities;
                    DateTime now = DateTime.UtcNow;
                    bool update = true;

                    foreach (var sourceEntity in retVal)
                    {
                        string[] restrictions = new string[3];
                        for (int i = 0; i < 3; i++)
                        {
                            restrictions[i] = null;
                        }

                        restrictions[0] = Dm8OracleConnector.GetSchemaName(sourceEntity.Function.SourceLocation);
                        restrictions[1] = Dm8OracleConnector.GetTableName(sourceEntity.Function.SourceLocation);

                        tables = await sqlConnection.GetSchemaAsync("Columns", restrictions);
                        var rc2 = new ObservableCollection<RawAttributBase>();
                        try
                        {
                            foreach (var col in tables.Rows.OfType<DataRow>().OrderBy(r => r.Field<decimal>("ID")))
                            {
                                rc2.Add(new RawAttributBase()
                                {
                                    Name = Dm8OracleConnector.ToNameSql(col.Field<string>(COLUMN_NAME)),
                                    Type = Dm8OracleConnector.FixDataType(col.Field<string>("DATATYPE")),
                                    CharLength = col.GetInt("LENGTH") >= 0 ? col.GetInt("LENGTH") : null,
                                    Precision = col.GetInt("PRECISION") >= 0 ? col.GetInt("PRECISION") : null,
                                    Scale = col.GetInt("SCALE") >= 0 ? col.GetInt("SCALE") : null,
                                    Nullable = col.Field<string>("NULLABLE") == "Y",
                                    DateModified = now.ToString("yyyy-MM-dd HH:mm:ss"),
                                    DateDeleted = null
                                });
                            }
                        }
                        catch (Exception ex1)
                        {
                            var sss = ex1.Message;
                        }

                        if (sourceEntity?.Entity?.Attribute == null)
                        {
                            sourceEntity.Entity.Attribute = rc2;
                        }
                        else
                        {
                            foreach (var attr in sourceEntity.Entity.Attribute)
                            {
                                var newAttr = rc2.FirstOrDefault(a => a.Name == attr.Name);
                                if (newAttr == null && attr.DateDeleted == null)
                                {
                                    // attr does not exist anymore
                                    attr.DateDeleted = now.ToString("yyyy-MM-dd HH:mm:ss");
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

        static bool ValidSchema(string schema)
        {
            schema = schema.ToLower();
            switch (schema)
            {
                case "sys":
                case "sysbackup":
                case "sysdg":
                case "syskm":
                case "sysrac":
                case "system":
                case "sys$umf":
                case "wmsys":
                case "xdb":
                case "xs$null":
                    return false;
            }
            return (true);
        }
    }
}

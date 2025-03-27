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

using Dm8Locator;
using Dm8Locator.Db;
using Dm8Locator.Db.TSql;
using Microsoft.Data.SqlClient;
using Microsoft.SqlServer.Management.Common;
using Microsoft.SqlServer.Management.Smo;
using Microsoft.SqlServer.TransactSql.ScriptDom;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace Dm8Locator.Db.TSql
{
    public class Dm8DataLocatorDbParser : Dm8DataLocatorDbParserBase
    {
        private string connectionString;
        private List<string> schemaList;

        private const int TABLE_SCHEMA = 0;
        private const int TABLE_NAME = 1;
        private const int COLUMN_NAME = 2;
        private const int ORDINAL_POSITION = 3;
        private const int COLUMN_DEFAULT = 4;
        private const int IS_NULLABLE = 5;
        private const int DATA_TYPE = 6;
        private const int CHARACTER_MAXIMUM_LENGTH = 7;
        private const int NUMERIC_PRECISION = 8;
        private const int NUMERIC_SCALE = 9;


        public Dm8DataLocatorDbParser(string dbName, string connectionString, Func<string[], string> createAdlName = null)
            : base(dbName, createAdlName)
        {
            this.connectionString = connectionString;
        }

        public async Task ScanDb(Action<Dm8LocatorBase> storeAdl, params string[] schemas)
        {
            this.schemaList = schemas.ToList();
            var tables = this.ScanTables(storeAdl);
            var views = this.ScanViews(storeAdl);
            await Task.WhenAll(tables, views);
        }

        private Task ScanTables(Action<Dm8LocatorBase> storeAdl)
        {
            return Task.Factory.StartNew(() =>
            {
                var db = this.CreateDatabaseConnection();
                var tables = db.Tables.OfType<Table>().Where(v => this.schemaList.Count() == 0 || this.schemaList.Any(s => StringComparer.InvariantCultureIgnoreCase.Compare(s, v.Schema) == 0));
                var tableScripts = tables.Select(v => new { Name = v.Name, Schema = v.Schema, Scripts = v.Script().OfType<string>() }).ToList();

                // Scan tables
                Parallel.ForEach(tableScripts, t =>
                {
                    string createTable = t.Scripts.Where(v => v.Contains("CREATE TABLE", StringComparison.InvariantCultureIgnoreCase)).FirstOrDefault();
                    if (createTable == null)
                        return;

                    // Create parser statement
                    TSqlParser parser = new TSql150Parser(false);
                    StringReader reader = new StringReader(createTable);
                    TSqlFragment fragment = parser.Parse(reader, out IList<ParseError> errors);

                    // Check if errors occurred
                    if (errors.Count() > 0)
                        throw new TSqlParserException($"Error parsing {t.Name}", errors);

                    // check if system table
                    if (IsSystemTable(t.Schema, t.Name))
                        return;

                    // Parse Views
                    TSqlTableVisitor tableVisitor = new TSqlTableVisitor();
                    tableVisitor.CreateDm8DataLocatorName = this.CreateDm8DataLocatorName;
                    tableVisitor.StoreDm8DataLocator = storeAdl;

                    fragment.Accept(tableVisitor);
                });
            });
        }


        private Task ScanViews(Action<Dm8LocatorBase> storeAdl)
        {
            return Task.Factory.StartNew(() =>
            {
                var db = this.CreateDatabaseConnection();
                var views = db.Views.OfType<View>().
                                Where(v => this.schemaList.Count() == 0 || this.schemaList.Any(s => StringComparer.InvariantCultureIgnoreCase.Compare(s, v.Schema) == 0));
                var viewScripts = views.Select(v => new { Name = v.Name, Scripts = v.Script().OfType<string>() }).ToList();
                Parallel.ForEach(viewScripts, v =>
                {
                    string createView = v.Scripts.Where(vs => vs.Contains("CREATE VIEW", StringComparison.InvariantCultureIgnoreCase)).FirstOrDefault();
                    if (createView == null)
                        return;

                    // Create parser statement
                    TSqlParser parser = new TSql150Parser(false);
                    StringReader reader = new StringReader(createView);
                    TSqlFragment fragment = parser.Parse(reader, out IList<ParseError> errors);

                    // Check if errors occurred
                    if (errors.Count() > 0)
                        throw new TSqlParserException($"Error parsing {v.Name}", errors);

                    // Parse Views
                    TSqlViewVisitor viewVisitor = new TSqlViewVisitor();
                    viewVisitor.CreateDm8DataLocatorName = this.CreateDm8DataLocatorName;
                    viewVisitor.StoreDm8DataLocator = storeAdl;

                    fragment.Accept(viewVisitor);
                });
            });
        }

        public Database CreateDatabaseConnection()
        {
            Database db = null;
            int retry = 0;
            while (true)
            {
                try
                {
                    SqlConnectionStringBuilder connectionString = new SqlConnectionStringBuilder(this.connectionString);
                    string server = connectionString.DataSource;
                    string database = connectionString.InitialCatalog;
                    string user = connectionString.UserID;
                    string passWd = connectionString.Password;

                    SqlConnectionInfo sqlConnectionInfo = new SqlConnectionInfo(server);
                    if (!string.IsNullOrEmpty(user))
                    {
                        sqlConnectionInfo.UserName = user;
                        sqlConnectionInfo.Password = passWd;
                    }
                    ServerConnection serverConnection = new ServerConnection(sqlConnectionInfo);
                    Server serverInstance = new Server(serverConnection);
                    serverInstance.ConnectionContext.StatementTimeout = 0;
                    serverInstance.ConnectionContext.MultipleActiveResultSets = true;
                    db = serverInstance.Databases.OfType<Database>().Where(d => d.Name == database).First();
                    break;
                }
                catch (Exception)
                {
                    retry++;
                    if (retry >= Properties.Settings.Default.ConnectRetry)
                        throw;
                    System.Threading.Thread.Sleep(Properties.Settings.Default.ConnectRetry);
                }
            }

            return db;
        }


        private async Task ScanTablesDb(Action<Dm8LocatorBase> storeAdl)
        {
            using (var sqlConnection = new SqlConnection(this.connectionString))
            {
                sqlConnection.Open();
                using (var sqlCmd = sqlConnection.CreateCommand())
                {
                    var cmdTxt = $"SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'";
                    foreach (var s in this.schemaList)
                    {
                        cmdTxt += $" AND TABLE_SCHEMA like '{s}%'";
                    }
                    sqlCmd.CommandText = cmdTxt;
                    using (var sqlRdr = await sqlCmd.ExecuteReaderAsync())
                    {
                        while (true)
                        {
                            var res = await sqlRdr.ReadAsync();
                            if (!res)
                                break;

                            string tableName = sqlRdr.GetString(TABLE_NAME);
                            string tableSchema = sqlRdr.GetString(TABLE_SCHEMA);

                            // check if system table
                            if (IsSystemTable(tableSchema, tableName))
                                continue;

                            string AdlName = this.CreateDm8DataLocatorName(new string[] { tableSchema, tableName });
                            Dm8LocatorTable AdlTable = new Dm8LocatorTable(AdlName);

                            // TODO: Fill direct attributes

                            storeAdl(AdlTable);
                        }
                    }
                }
            }
        }

        private static bool IsSystemTable(string tableSchema, string tableName)
        {
            if (tableSchema.ToLowerInvariant() == "dbo")
            {
                switch(tableName)
                {
                    case "sysdiagrams":
                        return true;
                }
            }
            return false;
        }

        private async Task ScanColumns(Action<Dm8LocatorBase> storeAdl)
        {
            using (var sqlConnection = new SqlConnection(this.connectionString))
            {
                sqlConnection.Open();
                using (var sqlCmd = sqlConnection.CreateCommand())
                {
                    var cmdTxt = @"SELECT t.TABLE_SCHEMA, t.TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION, COLUMN_DEFAULT, IS_NULLABLE, DATA_TYPE, c.CHARACTER_MAXIMUM_LENGTH, c.NUMERIC_PRECISION, c.NUMERIC_SCALE
                                    FROM INFORMATION_SCHEMA.COLUMNS AS c
                                    LEFT JOIN INFORMATION_SCHEMA.TABLES as t ON t.TABLE_NAME=c.TABLE_NAME
                                    WHERE t.TABLE_TYPE = 'BASE TABLE'";
                    foreach (var s in this.schemaList)
                    {
                        cmdTxt += $" AND t.TABLE_SCHEMA like '{s}%'";
                    }
                    sqlCmd.CommandText = cmdTxt;
                    using (var sqlRdr = await sqlCmd.ExecuteReaderAsync())
                    {
                        while (true)
                        {
                            var res = await sqlRdr.ReadAsync();
                            if (!res)
                                break;

                            string tableName = sqlRdr.GetString(TABLE_NAME);
                            string tableSchema = sqlRdr.GetString(TABLE_SCHEMA);
                            string columnName = sqlRdr.GetString(COLUMN_NAME);
                            int? ordinalPosition = GetValue<int>(sqlRdr, ORDINAL_POSITION);
                            string columnDefault = GetString(sqlRdr, COLUMN_DEFAULT);
                            string isNullable = GetString(sqlRdr, IS_NULLABLE);
                            string dataType = GetString(sqlRdr, DATA_TYPE);
                            int? maxLength = GetValue<int>(sqlRdr, CHARACTER_MAXIMUM_LENGTH);
                            int? precision = GetValue<byte>(sqlRdr, NUMERIC_PRECISION);
                            int? scale = GetValue<int>(sqlRdr, NUMERIC_SCALE);

                            // check if system table
                            if (IsSystemTable(tableSchema, tableName))
                                continue;

                            string AdlName = this.CreateDm8DataLocatorName(new string[] { tableSchema, tableName, columnName });
                            Dm8LocatorColumn AdlColumn = new Dm8LocatorColumn(AdlName);
                            // get constraints
                            if (isNullable == "NO")
                                AdlColumn.IsNullable = false;

                            if (columnDefault != null)
                            {
                                AdlColumn.DefaultExpression = columnDefault;
                                AdlColumn.DefaultExpressionType = Dm8DataLocatorColumnDataType.NONE;
                            }
                            AdlColumn.Ordinal = (short) (ordinalPosition ?? 0);
                            SetDm8DataLocatorType(AdlColumn, dataType, (Adl) => this.SetDataTypeLength(Adl, maxLength), (Adl) => this.SetPrecisionScale(Adl, precision, scale));
                            storeAdl(AdlColumn);
                        }


                    }
                }
            }
        }

        private static Nullable<T> GetValue<T>(SqlDataReader sqlRdr, int nr) where T : struct
        {
            return sqlRdr.IsDBNull(nr) ? null : sqlRdr.GetFieldValue<T>(nr);
        }

        private static string GetString(SqlDataReader sqlRdr, int nr)
        {
            return sqlRdr.IsDBNull(nr) ? null : sqlRdr.GetString(nr);
        }

        private void SetDataTypeLength(Dm8LocatorColumn Adl, int? length)
        {
            if (length != null && length > 0)
            {
                    Adl.DataTypeLength = length;
            }
            else
            {
                Adl.DataTypeLength = int.MaxValue;
            }
        }

        private void SetPrecisionScale(Dm8LocatorColumn Adl, int? precision, int? scale)
        {
            if (precision != null)
            {
                Adl.DataTypePrecision = precision;
            }
            else
            {
                Adl.DataTypeLength = 38;       // max for SQL Server
            }

            if (scale != null)
            {
                Adl.DataTypeScale = scale;
            }
            else
            {
                Adl.DataTypeScale = 0;       // max for SQL Server
            }

            if (Adl.DataTypeScale > Adl.DataTypePrecision)
            {
                throw new ArgumentException($"Scale '{Adl.DataTypeScale}' is higher than precision '{Adl.DataTypePrecision}' for '{Adl}'");
            }
        }

    }
}
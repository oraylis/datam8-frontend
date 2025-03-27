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

using Azure.Storage.Files.DataLake;
using Azure.Storage.Files.DataLake.Models;
using Dm8CSVConnector;
using Dm8LakeConnector.Views;
using Dm8PluginBase.BaseClasses;
using Dm8PluginBase.Extensions;
using Dm8PluginBase.Interfaces;
using Parquet;
using Parquet.Schema;
using System.Collections.ObjectModel;
using System.IO;
using Extensions = Dm8PluginBase.Extensions.Extensions;
using Path = System.IO.Path;


#pragma warning disable IDE0130
#pragma warning disable IDE0063
#pragma warning disable IDE0059

namespace Dm8LakeConnector
{
    #region Pragma
#pragma warning disable CS1998
#pragma warning disable CS8618
#pragma warning disable CS8602
#pragma warning disable CS8629
#pragma warning disable CS8600
#pragma warning disable CS8601
#pragma warning disable IDE0079 // Remove unnecessary suppression
#pragma warning disable CS0165
#pragma warning disable CA1859

    #endregion

    public class Dm8LakeConnector : IDm8PluginConnectorSourceExplorerV1
    {
        #region Properties
        public DataSourceBase Source { get; set; } = new DataSourceLake();
        public string DataSourceName { get; set; }
        public string Name { get; private set; } = "LakeSource";
        public string Layer { get; set; }
        public string DataModule { get; set; }
        public string DataProduct { get; set; }
        #endregion

        public Dictionary<string, string> DefaultDatatypes
        {
            get
            {
                Dictionary<string, string> retVal = new()
                {
                    { "boolean", "bit" },
                    { "float", "double" },
                    { "double", "decimal" },
                    { "datetimeoffset", "datetime" },
                    { "bytearray", "binary" },
                    { "string", "string" },
                    { "uuid", "uniqueidentifier" },
                    { "decimal", "decimal" },
                    { "interval", "binary" },
                    { "json", "string" },
                    { "enum", "string" },
                    { "map", "binary" },
                    { "list", "binary" },
                    { "int", "int" },
                    { "int16", "int" },
                    { "int32", "int" },
                    { "int64", "long" },
                    { "time", "datetime" },
                    { "timestamp", "long" }
                };
                return (retVal);
            }
        }
        public async Task ConnectAsync(string connectionString)
        {
            this.Source.Connect(connectionString);
        }
        public async Task<DateTime> RefreshAttributesAsync(RawModelEntryBase sourceEntity, bool update = false)
        {
            DateTime now = DateTime.UtcNow;

            DataSourceLake source = Extensions.ConvertClass<DataSourceLake, DataSourceBase>(this.Source);
            source.RealConnectionString = true;
            source.Connect(source.ConnectionString);

            var rc = new ObservableCollection<RawAttributBase>();
            var filePath = sourceEntity.Function.SourceLocation;
            var fileSystemClient = source.SetFilesystemClient(source.ConnectionString, source.AuthenticationMethod.ToString(), source.StoragePath);
            bool fileSelected = false;

            IAsyncEnumerator<PathItem> enumerator = fileSystemClient.GetPathsAsync(path: filePath, recursive: true).GetAsyncEnumerator();

            await enumerator.MoveNextAsync();
            PathItem item = enumerator.Current;

            while (item != null || fileSelected == true)
            {
                if (item.Name.ToLower().EndsWith(".parquet"))
                {
                    fileSelected = true;
                    Console.WriteLine(item.Name);

                    var fileClient = fileSystemClient.GetFileClient(item.Name);

                    // Stream File for getting meta
                    var downloadResponse = await fileClient.ReadAsync();

                    var reader = new BinaryReader(downloadResponse.Value.Content);


                    var bufferSize = 4096;

                    var buffer = new byte[bufferSize];
                    int count;

                    using (System.IO.MemoryStream ms = new())
                    {
                        while ((count = reader.Read(buffer, 0, buffer.Length)) != 0)
                        {
                            ms.Write(buffer, 0, count);
                        }

                        using (Stream fileStream = new MemoryStream(ms.ToArray()))
                        {
                            using (ParquetReader parquetReader = await ParquetReader.CreateAsync(fileStream, null, true))
                            {
                                // get file schema (available straight after opening parquet reader)
                                // however, get only data fields as only they contain data values
                                DataField[] dataFields = parquetReader.Schema.GetDataFields();

                                // Add Properties to List
                                foreach (var field in dataFields)
                                {

                                    rc.Add(new RawAttributBase
                                    {
                                        Name = field.Name,
                                        Type = field.ClrType.ToString().ToLower(),
                                        CharLength = null,
                                        Precision = null,
                                        Scale = null,
                                        Nullable = field.IsNullable,
                                        DateModified = now.ToString("yyyy-MM-dd HH:mm:ss"),
                                        DateDeleted = null
                                    });
                                }

                                if (sourceEntity.Entity.Attribute == null)
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

                                    foreach (var attr in rc)
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
                        };
                        return now;
                    }
                }


                if (item.Name.ToLower().EndsWith(".csv"))
                {
                    fileSelected = true;
                    Console.WriteLine(item.Name);

                    var fileClient = fileSystemClient.GetFileClient(item.Name);

                    // Stream File for getting meta
                    var downloadResponse = await fileClient.ReadAsync();
                    var reader = new BinaryReader(downloadResponse.Value.Content);
                    var bufferSize = 4096;
                    var buffer = new byte[bufferSize];
                    int count;
                    int written = 0;
                    string tempFile = Path.Combine(Path.GetTempPath(), Path.GetTempFileName());

                    using (var tempStream = new FileStream(tempFile, FileMode.Create, FileAccess.Write))
                    {
                        while ((count = reader.Read(buffer, 0, buffer.Length)) != 0)
                        {
                            tempStream.Write(buffer, 0, count);
                            written += count;
                            if (written >= 1024 * 1024)
                            {
                                break;
                            }
                        }
                    }

                    if (sourceEntity.Entity.Attribute == null || sourceEntity.Entity.Attribute.Count == 0)
                    {
                        Dm8CSVConnector.Dm8CSVConnector conCsv = new()
                        {
                            DataSourceName = this.DataSourceName
                        };
                        string conStrCsv = $"Filename={tempFile};Originalname={item.Name}";
                        if (conCsv.ConfigureConnection(ref conStrCsv, this.Source.ExtendedProperties))
                        {
                            DataSourceCSV dd = (DataSourceCSV)conCsv.Source;

                            foreach (var df in dd.Schema)
                            {
                                rc.Add(new RawAttributBase
                                {
                                    Name = df.Name,
                                    Type = df.Type.ToLower(),
                                    CharLength = df.Size,
                                    Precision = df.Precision,
                                    Scale = null,
                                    Nullable = df.NullEnabled,
                                    DateModified = now.ToString("yyyy-MM-dd HH:mm:ss"),
                                    DateDeleted = null
                                });
                            }

                            sourceEntity.Entity.Attribute = rc;
                        }
                    }
                }

                if (!await enumerator.MoveNextAsync())
                {
                    break;
                }

                item = enumerator.Current;
            }
            source.RealConnectionString = false;
            if (fileSelected != true)
            {
                throw new InvalidOperationException($"No Parquet file found in path: {filePath}");
            }
            else
            {
                return now;
            }
        }
        public bool ConfigureConnection(ref string conStr, Dictionary<string, string> extendedProperties)
        {
            bool retVal = false;
            var win = new ConfigureView();
            if (!String.IsNullOrEmpty(conStr))
            {
                DataSourceLake ds = new()
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
            IList<RawModelEntryBase> retVal = [];
            DataSourceLake source = Extensions.ConvertClass<DataSourceLake, DataSourceBase>(this.Source);
            source.RealConnectionString = true;
            source.Connect(source.ConnectionString);

            IAsyncEnumerator<PathItem> enumerator;
            var rc1 = new List<RawModelEntryBase>();

            string path = source.StoragePath;
            string storagePath = path;

            var storageItems = storagePath.Split([Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar]);

            DataLakeFileSystemClient fileSystemClient = source.SetFilesystemClient(conStr: source.ConnectionString, authenticationMethod: source.AuthenticationMethod.ToString(), containerName: storageItems[0]);
            if (storageItems.Length == 1)
            {
                enumerator = fileSystemClient.GetPathsAsync(recursive: true).GetAsyncEnumerator();
            }
            else
            {
                string folderPath = String.Join("/", storageItems.Skip(1).ToArray());
                DataLakeDirectoryClient directoryClient = fileSystemClient.GetDirectoryClient(folderPath);
                enumerator = directoryClient.GetPathsAsync(recursive: true).GetAsyncEnumerator();
            }

            await enumerator.MoveNextAsync();
            PathItem item = enumerator.Current;

            while (item != null)
            {
                RawModelEntryBase me = new()
                {
                    Type = "raw",
                    Entity = new RawEntityBase()
                    {
                        DataModule = this.DataModule,
                        DataProduct = this.DataProduct,
                        Name = Path.GetFileNameWithoutExtension(item.Name),
                        DisplayName = Path.GetFileName(item.Name).FromCamelCase(),
                        ObjectType = (bool)item.IsDirectory ? "Folder" : "File",
                        FolderName = (bool)item.IsDirectory ? item.Name : Path.GetDirectoryName(item.Name)
                    },
                    Schema = "",
                    Function = new RawFunctionBase()
                    {
                        DataSource = this.Source.Name,
                        SourceLocation = $"{item.Name}"
                    }
                };
                if (addFile(me.Entity.Dm8l))
                {
                    rc1.Add(me);
                }

                if (!await enumerator.MoveNextAsync())
                {
                    break;
                }

                item = enumerator.Current;
            }
            SelectObjects so = new()
            {
                BaseFolder = source.StoragePath,
                Entities = rc1,
                Title = "Select Objects"

            };
            if (so.ShowDialog() == true)
            {
                RawModelEntryBase m = so.SelectedEntry;
                await RefreshAttributesAsync(m, true);
                retVal.Add(m);
            }
            return (retVal);
        }

    }
}

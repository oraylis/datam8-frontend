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

using Azure.Core;
using Azure.Identity;
using Azure.Storage;
using Azure.Storage.Files.DataLake;
using Dm8PluginBase.BaseClasses;
using Dm8PluginBase.Helper;
using System.IO;
using System.Windows;
using Dm8CSVConnector.Classes;
using System.Collections.ObjectModel;
using System.Windows.Documents;
using Microsoft.IdentityModel.Tokens;
using Newtonsoft.Json;

#pragma warning disable IDE0130 // Namespace does not match folder structure
#pragma warning disable IDE0090
#pragma warning disable IDE0028
#pragma warning disable IDE0060
#pragma warning disable IDE1006
#pragma warning disable IDE0079 // Remove unnecessary suppression
#pragma warning disable CA1822 // Mark members as static

#pragma warning disable IDE0130 // Namespace does not match folder structure
#pragma warning disable IDE0090
#pragma warning disable IDE0028
#pragma warning disable IDE0060
#pragma warning disable IDE1006
#pragma warning disable IDE0079 // Remove unnecessary suppression
#pragma warning disable CA1822 // Mark members as static

namespace Dm8CSVConnector
{
#pragma warning disable CS8600
#pragma warning disable CS8601
#pragma warning disable CS8603

    public class DataSourceCSV : DataSourceBase
    {

        private string _connectionString = "";
        public string FileName = "";
        public string OriginalName = "";
        private string _encryptedData = "";
        public ConvertProperty Converter = new ConvertProperty();
        public List<FieldProperty> Schema = new List<FieldProperty>();

        public DataSourceCSV()
        {
            this.Name = "CSVSource";
        }
        public new string ConnectionString
        {
            get
            {
                string conStr = $"Filename={FileName};";
                if (!this.OriginalName.IsNullOrEmpty())
                {
                    conStr = $"Filename={FileName};Originalname={this.OriginalName}";
                }
                return (conStr);
            }
            set
            {
                _connectionString = value;
                this.FileName = getConnectionProperty(_connectionString, "Filename");
                this.OriginalName = getConnectionProperty(_connectionString, "Originalname");

            }
        }
        public new bool Validate(bool showMessage)
        {
            bool retVal = false;

            try
            {
                this.Connect(this.ConnectionString);
                if (showMessage)
                {
                    MessageBox.Show("Connection established", $@"Connection: {this.Name}");
                }

                retVal = true;
            }
            catch (Exception ex)
            {
                if (showMessage)
                {
                    MessageBox.Show(ex.Message, $@"Connection: {this.Name}");
                }
            }
            this.RealConnectionString = false;
            return (retVal);
        }
        public new bool Connect(string conStr)
        {
            bool retVal = true;
            return (retVal);
        }

        public new Dictionary<string, string> ExtendedProperties
        {
            get
            {
                base.ExtendedProperties.Clear();
                base.ExtendedProperties.Add("EncryptedData", _encryptedData);
                base.ExtendedProperties.Add("Settings", JsonConvert.SerializeObject(this.Converter, Formatting.None, new Newtonsoft.Json.Converters.StringEnumConverter()));
                base.ExtendedProperties.Add("Schema", JsonConvert.SerializeObject(this.Schema, Formatting.None, new Newtonsoft.Json.Converters.StringEnumConverter()));
                return (base.ExtendedProperties);
            }
            set
            {
                base.ExtendedProperties = value;
                if (base.ExtendedProperties.TryGetValue("Settings", out string json))
                {
                    this.Converter = JsonConvert.DeserializeObject<ConvertProperty>(json);
                }
                if (base.ExtendedProperties.TryGetValue("Schema", out string schema))
                {
                    this.Schema = JsonConvert.DeserializeObject<List<FieldProperty>>(schema);
                }
                if (base.ExtendedProperties.TryGetValue("EncryptedData", out string data))
                {
                    _encryptedData = data;
                }
            }
        }
        private string getConnectionProperty(string conStr, string key)
        {
            string retVal = "";

            try
            {
                Dictionary<string, string> dictionaryConnectionProperties = conStr.TrimEnd(';').Split(';')
                    .ToDictionary(item => item.Split('=', 2)[0], item => item.Split('=', 2)[1]);

                if (!dictionaryConnectionProperties.TryGetValue(key, out retVal))
                {
                    retVal = "";
                }
            }
            catch
            {

            }

            return (retVal);
        }
        public void AnalyseFile()
        {
            this.Schema.Clear();
            List<FieldProperty> retVal = new List<FieldProperty>();
            string file = this.FileName;

            if (!File.Exists(file))
            {
                throw new Exception("File not found");
            }

            int bufferSize = 1024 * 1024;
            char[] buffer = new char[bufferSize];
            using (StreamReader reader = new StreamReader(file))
            {
                int len = reader.ReadBlock(buffer, 0, bufferSize);
                if (len == 0)
                {
                    throw new Exception("Could not read from File or File is empty");
                }
            }

            string check = new string(buffer);

            if (check.IndexOf(this.Converter.GetSeparator) <= 0)
            {
                throw new Exception("Could not find Line Seperator");
            }
            string[] lines = check.Split(this.Converter.GetSeparator);


            if (lines.Length <= 0 || lines[0].IndexOf(this.Converter.GetDelimiter) <= 0)
            {
                throw new Exception("Could not find Field Delimiter");
            }
            string[] fields = lines[0].Split(this.Converter.GetDelimiter);

            int fld = 0;
            foreach (string name in fields)
            {
                string set = $"Field {++fld}";
                if (Converter.HeaderHasFieldnames)
                {
                    set = name;
                }
                retVal.Add(new FieldProperty{Name = set, Type = "string", NullEnabled = true});
            }

            this.Schema = retVal;

            return;
        }
    }
}

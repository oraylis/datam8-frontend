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
using Azure.Core;
using Azure.Identity;
using Azure.Storage;
using Azure.Storage.Files.DataLake;
using Oraylis.DataM8.PluginBase.BaseClasses;
using Oraylis.DataM8.PluginBase.Helper;

#pragma warning disable IDE0079 // Remove unnecessary suppression
#pragma warning disable CS8629 // Nullable value type may be null.
#pragma warning disable CS8600 // Nullable value type may be null.
#pragma warning disable CS8601 // Nullable value type may be null.
#pragma warning disable IDE0130 // Namespace does not match folder structure
#pragma warning disable IDE0090
#pragma warning disable IDE0028
#pragma warning disable IDE0060
#pragma warning disable IDE0063
#pragma warning disable IDE1006
#pragma warning disable CA1822 // Mark members as static

#pragma warning disable IDE0079 // Remove unnecessary suppression
#pragma warning disable CS8629 // Nullable value type may be null.
#pragma warning disable CS8600 // Nullable value type may be null.
#pragma warning disable CS8601 // Nullable value type may be null.
#pragma warning disable IDE0130 // Namespace does not match folder structure
#pragma warning disable IDE0090
#pragma warning disable IDE0028
#pragma warning disable IDE0060
#pragma warning disable IDE0063
#pragma warning disable IDE1006
#pragma warning disable CA1822 // Mark members as static

namespace Dm8LakeConnector
{
#pragma warning disable CS8600

   public class DataSourceLake:DataSourceBase
   {
      public enum LakeSourceAuthenticationMethod
      {
         AccountKey = 0,
         AzureAd = 1,
      }

      public string StorageAccountName = "";
      public string StoragePath = "";
      public LakeSourceAuthenticationMethod AuthenticationMethod = LakeSourceAuthenticationMethod.AccountKey;
      public string Secret = "";
      public string TenantID = "";
      public string ClientID = "";
      private string _connectionString = "";

      public DataSourceLake()
      {
         this.Name = "LakeSource";
      }

      public new string ConnectionString
      {
         get
         {
            string secret;
            string conStr =
                $"StorageAccountName={this.StorageAccountName};StoragePath={this.StoragePath};AuthenticationMethod={this.AuthenticationMethod}";

            if (this.RealConnectionString)
            {
               if (this.ExtendedProperties.TryGetValue("EncryptedData" ,out string cfile) &&
                   !String.IsNullOrEmpty(cfile))
               {
                  secret = UserData.Load(cfile);
                  switch (this.AuthenticationMethod)
                  {
                     case LakeSourceAuthenticationMethod.AccountKey:
                        conStr += $";AccessKey={secret}";
                        break;
                     case LakeSourceAuthenticationMethod.AzureAd:
                        conStr += $";Secret={secret}";
                        break;
                  }
               }
            }

            if (this.AuthenticationMethod == LakeSourceAuthenticationMethod.AzureAd)
            {
               conStr += $";TenantID={this.TenantID}; ClientID={this.ClientID}";
            }

            return (conStr);
         }
         set
         {
            _connectionString = value;
            this.StoragePath = getConnectionProperty(_connectionString ,"StoragePath");
            this.StorageAccountName = getConnectionProperty(_connectionString ,"StorageAccountName");
            this.ClientID = getConnectionProperty(_connectionString ,"ClientID");
            this.TenantID = getConnectionProperty(_connectionString ,"TenantID");
         }
      }

      public new bool Validate(bool showMessage)
      {
         bool retVal = false;
         this.RealConnectionString = true;

         try
         {
            this.Connect(this.ConnectionString);
            if (showMessage)
            {
               MessageBox.Show("Connection established" ,$@"Connection: {this.Name}");
            }

            retVal = true;
         } catch (Exception ex)
         {
            if (showMessage)
            {
               MessageBox.Show(ex.Message ,$@"Connection: {this.Name}");
            }
         }

         this.RealConnectionString = false;
         return (retVal);
      }

      public new bool Connect(string conStr)
      {
         bool retVal = true;
         string storagePath = getConnectionProperty(conStr ,"StoragePath");
         var storageItems = storagePath.Split([Path.DirectorySeparatorChar ,Path.AltDirectorySeparatorChar]);

         DataLakeFileSystemClient fileSystemClient = SetFilesystemClient(
             conStr: conStr ,
             authenticationMethod: getConnectionProperty(conStr ,"AuthenticationMethod") ,
             containerName: storageItems[0]);

         if (storageItems.Length == 1)
         {
            fileSystemClient.GetPropertiesAsync();
         } else
         {
            string folderPath = String.Join("/" ,storageItems.Skip(1).ToArray());
            DataLakeDirectoryClient directoryClient = fileSystemClient.GetDirectoryClient(folderPath);
            directoryClient.GetPropertiesAsync();
         }
         return (retVal);
      }
      private string getConnectionProperty(string conStr ,string key)
      {
         Dictionary<string ,string> dictionaryConnectionProperties = conStr.TrimEnd(';').Split(';').ToDictionary(item => item.Split('=' ,2)[0] ,item => item.Split('=' ,2)[1]);

         if (!dictionaryConnectionProperties.TryGetValue(key ,out string retVal))
         {
            retVal = "";
         }
         return (retVal);
      }

      public DataLakeFileSystemClient SetFilesystemClient(string conStr ,string authenticationMethod ,string containerName)
      {
         DataLakeServiceClient serviceClient = new DataLakeServiceClient(new Uri("https://" + getConnectionProperty(conStr ,"StorageAccountName") + ".dfs.core.windows.net") ,new DefaultAzureCredential());
         string accessKey = getConnectionProperty(conStr ,"AccessKey").Replace("\"" ,"");
         string storageAccount = getConnectionProperty(conStr ,"StorageAccountName");
         switch (authenticationMethod.ToLower())
         {
            case "accountkey":
               getDataLakeServiceClient(dataLakeServiceClient: ref serviceClient ,
                                       accountName: storageAccount ,
                                       accountKey: accessKey
                                        );
               break;
            case "azuread":
               getDataLakeServiceClient(dataLakeServiceClient: ref serviceClient ,
                                        accountName: storageAccount ,
                                        clientSecret: accessKey ,
                                        clientID: getConnectionProperty(conStr ,"ClientID") ,
                                        tenantID: getConnectionProperty(conStr ,"TenantID")
                                        );
               break;
         }
         DataLakeFileSystemClient filesystemClient = serviceClient.GetFileSystemClient(containerName);
         return filesystemClient;
      }
      private void getDataLakeServiceClient(ref DataLakeServiceClient dataLakeServiceClient ,string accountName ,string accountKey)
      {
         StorageSharedKeyCredential sharedKeyCredential = new StorageSharedKeyCredential(accountName ,accountKey);
         string dfsUri = "https://" + accountName + ".dfs.core.windows.net";
         dataLakeServiceClient = new DataLakeServiceClient(new Uri(dfsUri) ,sharedKeyCredential);
      }
      private void getDataLakeServiceClient(ref DataLakeServiceClient dataLakeServiceClient ,String accountName ,String clientID ,string clientSecret ,string tenantID)
      {
         TokenCredential credential = new ClientSecretCredential(tenantID ,clientID ,clientSecret ,new TokenCredentialOptions());
         string dfsUri = "https://" + accountName + ".dfs.core.windows.net";
         dataLakeServiceClient = new DataLakeServiceClient(new Uri(dfsUri) ,credential);
      }
      public string RealStoragePath
      {
         get
         {
            string[] storageItems = this.StoragePath.Split([Path.DirectorySeparatorChar ,Path.AltDirectorySeparatorChar]);
            return storageItems[0];
         }
      }
   }
}

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

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Azure.Identity;
using Azure.Security.KeyVault.Secrets;

namespace Dm8Data.Helper
{
   /// <summary>
   /// Helper to replace secrets placeholders in connection string
   /// </summary>
   public static class SecretHelper
   {
      /// <summary>
      /// Global cache for connection strings
      /// </summary>
      private static Dictionary<string ,string> secretConnectionStrings = new Dictionary<string ,string>();


      /// <summary>
      /// Get Secrets from Cache
      /// </summary>
      /// <param name="connectionString">Original connection string</param>
      /// <returns>Connection string with secrets</returns>
      /// <exception cref="ArgumentException">Key vault not accessable</exception
      public static async Task<string> GetSecretsFromCacheAsync(string connectionString)
      {
         lock (secretConnectionStrings)
         {
            if (secretConnectionStrings.ContainsKey(connectionString))
            {
               return secretConnectionStrings[connectionString];
            }
         }
         string rc = await ReplaceSecretsAsync(connectionString);
         lock (secretConnectionStrings)
         {
            secretConnectionStrings.Add(connectionString ,rc);
            return rc;
         }
      }

      /// <summary>
      /// Replace secret placeholders in connection strings
      /// Placeholder: {{keyvault/secret}}
      /// </summary>
      /// <param name="connectionString">Connection string with secret placeholders</param>
      /// <returns>Connection string with secrets</returns>
      /// <exception cref="ArgumentException">Key vault not accessable</exception>
      public static async Task<string> ReplaceSecretsAsync(string connectionString)
      {
         var originalConnectionString = connectionString;
         while (connectionString.Contains("{{") && connectionString.Contains("}}"))
         {
            // get next secret entry
            var secretStart = connectionString.IndexOf("{{");
            var secretEnd = connectionString.IndexOf("}}");
            var secretEntry = connectionString.Substring(secretStart + 2 ,secretEnd - secretStart - 2);
            var secretParams = secretEntry.Split('/');
            if (secretParams.Length != 2)
            {
               throw new ArgumentException($"Wrong Secret in connection {originalConnectionString} use {{key vault/secret}}");
            }

            // get key vault and secret
            var keyVaultName = secretParams[0];
            var secretName = secretParams[1];
            var value = await GetSecretAsync(keyVaultName ,secretName);

            // replace entry in result
            connectionString = connectionString.Substring(0 ,secretStart) + value + connectionString.Substring(secretEnd + 2);
         }
         return connectionString;
      }

      /// <summary>
      /// Get Secret from KeyVault
      /// </summary>
      /// <param name="keyVaultName">Name of KeyVault</param>
      /// <param name="secretName">Name of secret</param>
      /// <returns>Secret value</returns>
      /// <exception cref="NullReferenceException">KeyVault Secret value is null</exception>
      public static async Task<string> GetSecretAsync(string keyVaultName ,string secretName)
      {
         var secretClient = new SecretClient(
                 new Uri(string.Format("https://{0}.vault.azure.net/" ,keyVaultName)) ,
                 new DefaultAzureCredential());
         var keyVaultSecret = await secretClient.GetSecretAsync(secretName);

         if (keyVaultSecret.Value == null)
            throw new NullReferenceException($"Unable to get secret {secretName} from {keyVaultName}");

         return keyVaultSecret.Value.Value;
      }
   }
}

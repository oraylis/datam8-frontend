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
using System.Threading.Tasks;
using Newtonsoft.Json;
using RestSharp;

namespace Dm8Data.Helper
{
   public class AzHelper
   {
      private readonly string tenantId;
      private readonly string resource;
      private readonly string clientId;
      private readonly string clientSecret;

      // private string accessToken;

      public AzHelper(string tenantId ,string resource ,string synapseWorkSpace ,string clientId ,string clientSecret)
      {
         this.tenantId = tenantId;
         this.resource = resource;
         this.clientId = clientId;
         this.clientSecret = clientSecret;
      }

      protected async Task<string> GetResourceAccessTokenAsync()
      {
         var reqUrl = new Uri($"https://login.microsoftonline.com/{this.tenantId}/oauth2/token");
         var options = new RestClientOptions { BaseUrl = reqUrl ,Timeout = TimeSpan.FromSeconds(5) };
         var client = new RestClient(options);

         var request = new RestRequest(reqUrl.AbsoluteUri ,Method.Post);
         request.AddHeader("Content-Type" ,"application/x-www-form-urlencoded");
         request.AddParameter("grant_type" ,"client_credentials");
         request.AddParameter("client_id" ,this.clientId);
         request.AddParameter("client_secret" ,this.clientSecret);
         request.AddParameter("resource" ,this.resource);

         RestResponse response = await client.ExecuteAsync(request);
         if (response.StatusCode != System.Net.HttpStatusCode.OK)
         {
            throw new Exception(response.StatusCode.ToString() + " - " + response.Content);
         }
         else
         {
            var res = JsonConvert.DeserializeObject<dynamic>(response.Content);
            if (res.TryGetValue("access_token" ,out object accessToken))
            {
               return accessToken.ToString();
            }
            else
            {
               throw new Exception("ResponseError: access_token not found");
            }
         }

      }
   }
}

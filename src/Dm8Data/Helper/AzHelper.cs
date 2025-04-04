using Newtonsoft.Json;
using RestSharp;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Dm8Data.Helper
{
    public class AzHelper
    {
        private readonly string tenantId;
        private readonly string resource;
        private readonly string clientId;
        private readonly string clientSecret;

        // private string accessToken;

        public AzHelper(string tenantId, string resource, string synapseWorkSpace, string clientId, string clientSecret)
        {
            this.tenantId = tenantId;
            this.resource = resource;
            this.clientId = clientId;
            this.clientSecret = clientSecret;
        }

        protected async Task<string> GetResourceAccessTokenAsync()
        {
            var reqUrl = new Uri($"https://login.microsoftonline.com/{this.tenantId}/oauth2/token");
            var options = new RestClientOptions { BaseUrl = reqUrl, Timeout = TimeSpan.FromSeconds(5) };
            var client = new RestClient(options);

            var request = new RestRequest(reqUrl.AbsoluteUri, Method.Post);
            request.AddHeader("Content-Type", "application/x-www-form-urlencoded");
            request.AddParameter("grant_type", "client_credentials");
            request.AddParameter("client_id", this.clientId);
            request.AddParameter("client_secret", this.clientSecret);
            request.AddParameter("resource", this.resource);

            RestResponse response = await client.ExecuteAsync(request);
            if (response.StatusCode != System.Net.HttpStatusCode.OK)
            {
                throw new Exception(response.StatusCode.ToString() + " - " + response.Content);
            }
            else 
            {
                var res = JsonConvert.DeserializeObject<dynamic>(response.Content);
                if (res.TryGetValue("access_token", out object accessToken))
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

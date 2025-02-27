using Dm8OracleConnector.Views;
using Dm8PluginBase.BaseClasses;
using Dm8PluginBase.Extensions;
using Dm8PluginBase.Helper;
using Oracle.ManagedDataAccess.Client;
using System.Windows;

namespace Dm8OracleConnector
{
#pragma warning disable CS8600

    public class DataSourceOracle : DataSourceBase
    {
        public enum OracleConnectionType
        {
            Service = 0,
            Sid = 1
        }
        public string Host { get; set; } = "";
        public string Port { get; set; } = "1521";
        public string Connection { get; set; } = "";
        public OracleConnectionType ConnectionType { get; set; } = OracleConnectionType.Service;
        public string UserId { get; set; } = "";
        public string Password { get; set; } = "";
        public OracleAllowedLogonVersionClient ProtocolVersion { get; set; } = OracleAllowedLogonVersionClient.Version11;
        public DataSourceOracle()
        {
            this.Name = "OracleDataSource";
        }

        public new string ConnectionString
        {
            get
            {
                string retValue = "";
                string pwd = "";
                if (!this.RealConnectionString)
                {
                    retValue =
                        $"Host={this.Host};Port={this.Port};ConnectionType={this.ConnectionType};Connection={this.Connection};User={this.UserId};ProtocolVersion={this.ProtocolVersion}";
                }
                else
                {
                    if (!String.IsNullOrEmpty(this.Password))
                    {
                        pwd = this.Password;
                    }
                    else
                    {
                        if (this.ExtendedProperties.TryGetValue("EncryptedData", out string cfile) &&
                            !String.IsNullOrEmpty(cfile))
                        {
                            pwd = UserData.Load(cfile);
                        }

                        if (string.IsNullOrEmpty(pwd))
                        {
                            EnterSecretView w = new EnterSecretView();
                            if (w.ShowDialog() == true)
                            {
                                pwd = w.Passwort;
                            }
                        }
                        this.Password = pwd;
                    }
                    string conType = "";
                    switch (this.ConnectionType)
                    {
                        case OracleConnectionType.Sid:
                            conType = "SID";
                            break;
                        default:
                            conType = "SERVICE_NAME";
                            break;
                    }
                    retValue = $"Data Source=(DESCRIPTION =(ADDRESS = (PROTOCOL = TCP)(HOST = {this.Host})(PORT = {this.Port}))(CONNECT_DATA = ({conType} = {this.Connection})));Password={pwd};User Id={this.UserId}";
                }
                return retValue;
            }
            set
            {
                //"Host=aut0ora0dev.westeurope.cloudapp.azure.com;Port=1521;ConnectionType=SID;Connection=oratest2;User=datam8"
                this.Host = getConnectionProperty(value, "Host");
                this.Port = getConnectionProperty(value, "Port");
                string conType = getConnectionProperty(value, "ConnectionType");
                switch (conType.ToUpper())
                {
                    case "SID":
                        this.ConnectionType = OracleConnectionType.Sid;
                        break;
                    default:
                        this.ConnectionType = OracleConnectionType.Service;
                        break;
                }
                this.Connection = getConnectionProperty(value, "Connection");
                this.UserId = getConnectionProperty(value, "User");
                this.ProtocolVersion = getConnectionProperty(value, "ProtocolVersion", "Version11").ToEnum<OracleAllowedLogonVersionClient>();
            }
        }
        public new bool Validate(bool showMessage)
        {
            bool retVal = false;
            this.RealConnectionString = true;

            using (var sqlConnection = new OracleConnection($"{this.ConnectionString};Connect Timeout=5"))
            {
                sqlConnection.SetVersion(this.ProtocolVersion);
                try
                {
                    sqlConnection.Open();
                    sqlConnection.Close();
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
            }
            this.RealConnectionString = false;
            return (retVal);
        }
        private string getConnectionProperty(string conStr, string key)
        {
            string retVal = "";
            Dictionary<string, string> dictionaryConnectionProperties = conStr.TrimEnd(';').Split(';').ToDictionary(item => item.Split('=', 2)[0], item => item.Split('=', 2)[1]);

            if (!dictionaryConnectionProperties.TryGetValue(key, out retVal))
            {
                retVal = "";
            }
            return (retVal);
        }
        private string getConnectionProperty(string conStr, string key, string defaultvalue)
        {
            string retVal = getConnectionProperty(conStr, key);
            if (String.IsNullOrEmpty(retVal))
            {
                retVal = defaultvalue;
            }
            return (retVal);
        }
    }
}

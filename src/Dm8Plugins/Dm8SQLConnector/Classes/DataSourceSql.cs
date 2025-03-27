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

using System.Windows;
using Dm8LakeConnector.Views;
using Dm8PluginBase.BaseClasses;
using Dm8PluginBase.Helper;
using Microsoft.Data.SqlClient;

namespace Dm8LakeConnector
{
#pragma warning disable CS8600

    public class DataSourceSql : DataSourceBase
    {
        public enum DataSourceSqlAuthentication
        {
            Windows_Authentication = 0,
            SQL_Server_Authentication = 1,
            Active_Directory_Integrated = 2,
            Active_Directory_Password = 3,
            Active_Directory_Interactive = 4
        }
        public enum YesNoIgnore
        {
            Yes = 0,
            No = 1,
            Ignore = 2
        }
        public enum YesNo
        {
            Yes = 0,
            No = 1
        }
        public string ServerName { get; set; } = "";
        public DataSourceSqlAuthentication Authentication { get; set; } =
            DataSourceSqlAuthentication.Windows_Authentication;
        public string InitialCatalog { get; set; } = "";
        public bool IntegratedSecurity { get; set; } = false;
        public YesNoIgnore TrustedConnection { get; set; } = YesNoIgnore.Ignore;
        public YesNo TrustServerCertificate { get; set; } = YesNo.Yes;
        public YesNoIgnore Encrypt { get; set; } = YesNoIgnore.Ignore;
        public string UserId { get; set; } = "";
        public string Password { get; set; } = "";
        private bool NeedPassword { get; set; } = false;
        public DataSourceSql()
        {
            this.Name = "SqlDataSource";
        }
        public new string ConnectionString
        {
            get
            {
                SqlConnectionStringBuilder con = new SqlConnectionStringBuilder();
                bool withPwd = false;
                con.DataSource = StringHelper.Decode(this.ServerName);
                if (!String.IsNullOrEmpty(this.InitialCatalog))
                {
                    con.InitialCatalog = this.InitialCatalog;
                }

                if (this.TrustServerCertificate == YesNo.Yes)
                {
                    con.TrustServerCertificate = true;
                }

                switch (this.Encrypt)
                {
                    case YesNoIgnore.Yes:
                        con.Encrypt = SqlConnectionEncryptOption.Mandatory;
                        break;
                    case YesNoIgnore.No:
                        break;
                    case YesNoIgnore.Ignore:
                        con.Encrypt = SqlConnectionEncryptOption.Optional;
                        break;
                }

                switch (this.Authentication)
                {
                    case DataSourceSqlAuthentication.Active_Directory_Integrated:
                        con.Authentication = SqlAuthenticationMethod.ActiveDirectoryIntegrated;
                        break;
                    case DataSourceSqlAuthentication.Active_Directory_Interactive:
                        con.UserID = this.UserId;
                        con.Authentication = SqlAuthenticationMethod.ActiveDirectoryInteractive;
                        break;
                    case DataSourceSqlAuthentication.Active_Directory_Password:
                        con.UserID = this.UserId;
                        withPwd = true;
                        con.Authentication = SqlAuthenticationMethod.ActiveDirectoryPassword;
                        break;
                    case DataSourceSqlAuthentication.SQL_Server_Authentication:
                        con.UserID = this.UserId;
                        withPwd = true;
                        break;
                    case DataSourceSqlAuthentication.Windows_Authentication:
                        con.IntegratedSecurity = true;
                        break;
                    default:
                        con.Authentication = SqlAuthenticationMethod.NotSpecified;
                        break;
                }

                if (withPwd)
                {
                    string pwd = "";
                    if (this.RealConnectionString)
                    {
                        if (!String.IsNullOrEmpty(this.Password))
                        {
                            con.Password = this.Password;
                        }
                        else
                        {
                            if (this.ExtendedProperties.TryGetValue("EncryptedData", out string cfile) &&
                                !String.IsNullOrEmpty(cfile))
                            {
                                pwd = UserData.Load(cfile);
                                con.Password = pwd;
                            }
                            if (this.NeedPassword && string.IsNullOrEmpty(pwd))
                            {
                                EnterSecretView w = new EnterSecretView();
                                if (w.ShowDialog() == true)
                                {
                                    con.Password = w.Passwort;
                                }
                            }
                        }
                    }
                }

                string conStr = con.ConnectionString;
                return (conStr);
            }
            set
            {
                SqlConnectionStringBuilder con = new SqlConnectionStringBuilder(value);
                this.ServerName = StringHelper.Encode(con.DataSource);
                this.InitialCatalog = con.InitialCatalog;
                this.TrustServerCertificate = con.TrustServerCertificate ? YesNo.Yes : YesNo.No;
                this.Encrypt = (con.Encrypt == SqlConnectionEncryptOption.Mandatory) ? YesNoIgnore.Yes :
                    con.Encrypt == SqlConnectionEncryptOption.Optional ? YesNoIgnore.Ignore : YesNoIgnore.No;
                this.NeedPassword = false;

                switch (con.Authentication)
                {
                    case SqlAuthenticationMethod.NotSpecified:
                        if (con.IntegratedSecurity)
                        {
                            this.Authentication = DataSourceSqlAuthentication.Windows_Authentication;
                        }
                        else
                        {
                            this.UserId = con.UserID;
                            this.Password = con.Password;
                            this.NeedPassword = true;
                            this.Authentication = DataSourceSqlAuthentication.SQL_Server_Authentication;
                        }
                        break;

                    case SqlAuthenticationMethod.ActiveDirectoryIntegrated:
                        this.Authentication = DataSourceSqlAuthentication.Active_Directory_Integrated;
                        break;

                    case SqlAuthenticationMethod.ActiveDirectoryInteractive:
                        this.UserId = con.UserID;
                        this.Authentication = DataSourceSqlAuthentication.Active_Directory_Interactive;
                        break;
                    case SqlAuthenticationMethod.ActiveDirectoryPassword:
                        this.UserId = con.UserID;
                        this.Password = con.Password;
                        this.NeedPassword = true;
                        this.Authentication = DataSourceSqlAuthentication.Active_Directory_Password;
                        break;
                    case SqlAuthenticationMethod.SqlPassword:
                        this.UserId = con.UserID;
                        this.Password = con.Password;
                        this.NeedPassword = true;
                        this.Authentication = DataSourceSqlAuthentication.SQL_Server_Authentication;
                        break;
                    case SqlAuthenticationMethod.ActiveDirectoryDefault:
                        this.Authentication = DataSourceSqlAuthentication.Windows_Authentication;
                        break;
                    default:
                        this.Authentication = DataSourceSqlAuthentication.Windows_Authentication;
                        break;
                }
            }
        }
        public new bool Validate(bool showMessage)
        {
            bool retVal = false;
            this.RealConnectionString = true;
            using (SqlConnection sqlConnection = new SqlConnection($"{this.ConnectionString};Connect Timeout=5"))
            {
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
        public List<string> Databases()
        {
            List<string> retVal = new List<string>();
            this.RealConnectionString = true;
            using (SqlConnection sqlConnection = new SqlConnection($"{this.ConnectionString};Connect Timeout=5"))
            {
                try
                {
                    sqlConnection.Open();
                    string query =
                        "select  [DatabaseName] = d.name from sys.databases d join sys.server_principals p on p.sid = d.owner_sid where p.name <> 'sa' and d.name not like '%$%' order by 1;";
                    using (SqlCommand command = new SqlCommand(query, sqlConnection))
                    {
                        using (SqlDataReader reader = command.ExecuteReader())
                        {
                            while (reader.Read())
                            {
                                retVal.Add(reader.GetString(0));
                            }
                        }
                    }
                    sqlConnection.Close();
                }
                catch
                {
                }
            }
            this.RealConnectionString = false;
            return (retVal);
        }
    }
}

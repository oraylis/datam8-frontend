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
using System.Windows.Controls;
using Oraylis.DataM8.PluginBase.Extensions;
using Oraylis.DataM8.PluginBase.Helper;

namespace Dm8LakeConnector.Views
{
#pragma warning disable CS8629 // Nullable value type may be null.
#pragma warning disable CS8600 // Nullable value type may be null.

   public partial class ConfigureView:Window
   {
      #region Properties
      private bool _screenInitDone = false;
      private DataSourceSql _source = new DataSourceSql();
      public string DataSourcename
      {
         get
         {
            return (DataSourceName.Text);
         }
         set
         {
            DataSourceName.Text = value;
         }
      }
      public DataSourceSql Source
      {
         get
         {
            _source.ServerName = StringHelper.Encode(ServerName.Text);
            _source.InitialCatalog = DatabaseName.Text;
            _source.UserId = UserName.Text;
            _source.Password = Password.Password;
            _source.Encrypt = (DataSourceSql.YesNoIgnore)Encrypt.SelectedItem;
            _source.TrustServerCertificate = (DataSourceSql.YesNo)TrustServerCertificate.SelectedItem;
            if ((bool)RememberPassword.IsChecked)
            {
               _source.ExtendedProperties["RememberPassword"] = "true";
               if (!_source.ExtendedProperties.ContainsKey("EncryptedData") || String.IsNullOrEmpty(_source.ExtendedProperties["EncryptedData"]))
               {
                  _source.ExtendedProperties["EncryptedData"] = Guid.NewGuid().ToString().ToUpper();
               }
               string file = _source.ExtendedProperties["EncryptedData"];
               string data = Password.Password;
               UserData.Save(file ,data);
            } else
            {
               _source.ExtendedProperties["RememberPassword"] = "false";
               if (_source.ExtendedProperties.ContainsKey("EncryptedData"))
               {
                  string file = _source.ExtendedProperties["EncryptedData"];
                  UserData.Delete(file);
               }
               _source.ExtendedProperties.Remove("EncryptedData");
            }
            return _source;
         }
         set
         {
            _source = value;
            Authentication.SelectedItem = _source.Authentication.GetFriendlyName();
            Encrypt.SelectedItem = _source.Encrypt;
            TrustServerCertificate.SelectedItem = _source.TrustServerCertificate;
            DatabaseName.Text = _source.InitialCatalog;
            UserName.Text = _source.UserId;
            Password.Password = _source.Password;
            ServerName.Text = StringHelper.Decode(_source.ServerName);
            RememberPassword.IsChecked = false;

            if (_source.ExtendedProperties.ContainsKey("RememberPassword"))
            {
               RememberPassword.IsChecked = _source.ExtendedProperties["RememberPassword"].ToLower() == "true"
                   ? true
                   : false;
            }
            if ((bool)RememberPassword.IsChecked)
            {
               if (!_source.ExtendedProperties.ContainsKey("EncryptedData") || String.IsNullOrEmpty(_source.ExtendedProperties["EncryptedData"]))
               {
                  _source.ExtendedProperties["EncryptedData"] = Guid.NewGuid().ToString().ToUpper();
               }
               string file = _source.ExtendedProperties["EncryptedData"];
               Password.Password = UserData.Load(file);
            } else
            {
               _source.ExtendedProperties.Remove("EncryptedData");
            }

            this.validateLayout();
         }
      }
      #endregion

      #region .ctor & init
      public ConfigureView()
      {
         InitializeComponent();
         initComboboxes();
         UserName.Text = $@"{Environment.UserDomainName}\{Environment.UserName}";
         Password.Password = "";
         RememberPassword.IsChecked = false;
         _screenInitDone = true;
         Authentication.SelectedIndex = 0;
         validateContent();
      }
      private void initComboboxes()
      {
         Authentication.ItemsSource = DataSourceSql.DataSourceSqlAuthentication.Active_Directory_Integrated.GetFriendlyNames();

         Encrypt.ItemsSource = Enum.GetValues(typeof(DataSourceSql.YesNoIgnore));
         Encrypt.SelectedItem = DataSourceSql.YesNoIgnore.Yes;

         TrustServerCertificate.ItemsSource = Enum.GetValues(typeof(DataSourceSql.YesNo));
         TrustServerCertificate.SelectedItem = DataSourceSql.YesNo.Yes;
      }
      #endregion

      #region ControlEvents
      private void OnControlChanged(object sender ,SelectionChangedEventArgs e)
      {
         this.validate(sender);
      }
      private void OnControlChanged(object sender ,TextChangedEventArgs e)
      {
         this.validate(sender);
      }
      private void OnControlChanged(object sender ,System.Windows.Input.TextCompositionEventArgs e)
      {
         this.validate(sender);
      }

      private void TestConnectionButton_Click(object sender ,RoutedEventArgs e)
      {
         this.Source.Validate(true);
      }
      private void OkButton_Click(object sender ,RoutedEventArgs e)
      {
         if (this.Source.Validate(false))
         {
            this.DialogResult = true;
         }
      }
      private void CancelButton_Click(object sender ,RoutedEventArgs e)
      {
         this.DialogResult = false;
      }
      #endregion

      #region Validator
      private void validate(object sender)
      {
         if (!_screenInitDone)
         {
            return;
         }

         if (sender.GetType() == typeof(ComboBox))
         {
            ComboBox cmb = (ComboBox)sender;
            if (cmb.Name == "Authentication")
            {
               string itm = Authentication.SelectedItem.ToString();

               if (!String.IsNullOrEmpty(itm))
               {
                  itm = itm.Replace(" " ,"_");
                  _source.Authentication =
                      (DataSourceSql.DataSourceSqlAuthentication)Enum.Parse(
                          typeof(DataSourceSql.DataSourceSqlAuthentication) ,itm ,true);
               }
            }
         }

         this.validateLayout();
      }
      private void validateContent()
      {
         bool validState = true;
         bool testState = true;

         if (String.IsNullOrEmpty(DataSourceName.Text))
         {
            validState = false;
         }
         if (String.IsNullOrEmpty(ServerName.Text))
         {
            validState = false;
            testState = false;
         }
         if (String.IsNullOrEmpty(DatabaseName.Text))
         {
            validState = false;
            testState = false;
         }
         OkButton.IsEnabled = validState;
         TestConnectionButton.IsEnabled = testState;
      }
      private void validateLayout()
      {
         bool setUser = true;
         bool setPassword = true;
         bool setRemember = true;
         bool showPassword = true;
         bool showRemember = true;
         string textUserName = "User Name:";
         switch (_source.Authentication)
         {
            case DataSourceSql.DataSourceSqlAuthentication.Windows_Authentication:
               textUserName = "User Name:";
               setUser = false;
               setPassword = false;
               setRemember = false;
               showPassword = false;
               showRemember = false;
               UserName.Text = $@"{Environment.UserDomainName}\{Environment.UserName}";
               Password.Password = "";
               RememberPassword.IsChecked = false;
               break;

            case DataSourceSql.DataSourceSqlAuthentication.SQL_Server_Authentication:
               textUserName = "Login:";
               setUser = true;
               setPassword = true;
               setRemember = true;
               showPassword = true;
               showRemember = true;
               break;

            case DataSourceSql.DataSourceSqlAuthentication.Active_Directory_Interactive:
               textUserName = "User Name:";
               setUser = true;
               setPassword = false;
               RememberPassword.IsChecked = false;
               setRemember = false;
               showPassword = false;
               showRemember = false;
               break;

            case DataSourceSql.DataSourceSqlAuthentication.Active_Directory_Password:
               textUserName = "User Name:";
               setUser = true;
               setPassword = true;
               setRemember = true;
               showPassword = true;
               showRemember = true;
               break;

            case DataSourceSql.DataSourceSqlAuthentication.Active_Directory_Integrated:
               textUserName = "User Name:";
               setUser = false;
               setPassword = false;
               setRemember = false;
               RememberPassword.IsChecked = false;
               showPassword = false;
               showRemember = false;
               break;
         }

         txtUserName.Content = textUserName;
         RememberPassword.IsEnabled = setRemember;
         RememberPassword.Visibility = showRemember ? Visibility.Visible : Visibility.Hidden;
         UserName.IsEnabled = setUser;
         Password.IsEnabled = setPassword;
         Password.Visibility = showPassword ? Visibility.Visible : Visibility.Hidden;
         txtPassword.Visibility = showPassword ? Visibility.Visible : Visibility.Hidden;
         this.validateContent();
      }
      private void DatabaseName_DropDownOpened(object sender ,EventArgs e)
      {
         if (ServerName.Text.Length > 0)
         {
            DatabaseName.ItemsSource = this.Source.Databases();
         }
      }
      private void DatabaseName_DropDownClosed(object sender ,EventArgs e)
      {
         this.validate(sender);
      }
      #endregion
   }
}

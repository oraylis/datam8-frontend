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
using Oraylis.DataM8.PluginBase.Helper;

namespace Dm8LakeConnector.Views
{
#pragma warning disable CS8629 // Nullable value type may be null.
#pragma warning disable CS8600 // Nullable value type may be null.

   public partial class ConfigureView:Window
   {
      #region Properties
      private bool _screenInitDone = false;
      private DataSourceLake _source = new DataSourceLake();
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
      public DataSourceLake Source
      {
         get
         {
            _source.StorageAccountName = StorageAccountName.Text;
            _source.StoragePath = StoragePath.Text;
            _source.AuthenticationMethod = (bool)rdbAzureID.IsChecked
                ? DataSourceLake.LakeSourceAuthenticationMethod.AzureAd
                : DataSourceLake.LakeSourceAuthenticationMethod.AccountKey;
            _source.Secret = Secret.Password;
            _source.TenantID = TenantID.Text;
            _source.ClientID = ClientID.Text;
            if (!_source.ExtendedProperties.ContainsKey("EncryptedData") || String.IsNullOrEmpty(_source.ExtendedProperties["EncryptedData"]))
            {
               _source.ExtendedProperties["EncryptedData"] = Guid.NewGuid().ToString().ToUpper();
            }
            string file = _source.ExtendedProperties["EncryptedData"];
            string data = Secret.Password;
            UserData.Save(file ,data);
            return _source;
         }
         set
         {
            _source = value;
            switch (_source.AuthenticationMethod)
            {
               case DataSourceLake.LakeSourceAuthenticationMethod.AzureAd:
                  rdbAccountKey.IsChecked = false;
                  rdbAzureID.IsChecked = true;
                  break;
               case DataSourceLake.LakeSourceAuthenticationMethod.AccountKey:
                  rdbAccountKey.IsChecked = true;
                  rdbAzureID.IsChecked = false;
                  break;
            }
            StorageAccountName.Text = _source.StorageAccountName;
            StoragePath.Text = _source.StoragePath;
            TenantID.Text = _source.TenantID;
            ClientID.Text = _source.ClientID;
            if (!_source.ExtendedProperties.ContainsKey("EncryptedData") || String.IsNullOrEmpty(_source.ExtendedProperties["EncryptedData"]))
            {
               _source.ExtendedProperties["EncryptedData"] = Guid.NewGuid().ToString().ToUpper();
            }
            string file = _source.ExtendedProperties["EncryptedData"];
            Secret.Password = UserData.Load(file);
            this.validateLayout();
         }
      }
      #endregion

      #region .ctor & init
      public ConfigureView()
      {
         InitializeComponent();
         Secret.Password = "";
         rdbAccountKey.IsChecked = true;
         _screenInitDone = true;
         validateLayout();
      }
      #endregion

      #region ControlEvents
      private void OnControlChanged(object sender ,RoutedEventArgs e)
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
         if (String.IsNullOrEmpty(StorageAccountName.Text))
         {
            validState = false;
            testState = false;
         }
         if (String.IsNullOrEmpty(StoragePath.Text))
         {
            validState = false;
            testState = false;
         }
         if (String.IsNullOrEmpty(Secret.Password))
         {
            validState = false;
            testState = false;
         }
         OkButton.IsEnabled = validState;
         TestConnectionButton.IsEnabled = testState;
      }
      private void validateLayout()
      {
         if ((bool)rdbAccountKey.IsChecked)
         {
            txtSecret.Content = "Access Key";
            txtTenantID.Visibility = Visibility.Hidden;
            TenantID.Visibility = Visibility.Hidden;
            txtClientID.Visibility = Visibility.Hidden;
            ClientID.Visibility = Visibility.Hidden;
         }

         if ((bool)rdbAzureID.IsChecked)
         {
            txtSecret.Content = "Secret";
            txtTenantID.Visibility = Visibility.Visible;
            TenantID.Visibility = Visibility.Visible;
            txtClientID.Visibility = Visibility.Visible;
            ClientID.Visibility = Visibility.Visible;
         }
         this.validateContent();
      }
      #endregion
   }
}

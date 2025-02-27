using System.IO;
using Dm8PluginBase.Extensions;
using System.Windows;
using System.Windows.Controls;
using Dm8PluginBase.Helper;
using Oracle.ManagedDataAccess.Client;

namespace Dm8OracleConnector.Views
{
#pragma warning disable CS8629 // Nullable value type may be null.
#pragma warning disable CS8600 // Nullable value type may be null.

    public partial class ConfigureView : Window
    {
        #region Properties
        private bool _screenInitDone = false;
        private DataSourceOracle _source = new DataSourceOracle();
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
        public DataSourceOracle Source
        {
            get
            {
                _source.Host = HostName.Text;
                _source.UserId = UserName.Text;
                _source.Password = Password.Password;
                _source.Connection = Connection.Text;
                _source.Port = Port.Text;
                switch (ConnectionType.Text.ToUpper())
                {
                    case "SID":
                        _source.ConnectionType = DataSourceOracle.OracleConnectionType.Sid;
                        break;
                    default:
                        _source.ConnectionType = DataSourceOracle.OracleConnectionType.Service;
                        break;
                }
                _source.ProtocolVersion = ProtocolVersion.Text.ToEnum<OracleAllowedLogonVersionClient>();
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
                }
                else
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
                UserName.Text = _source.UserId;
                Password.Password = _source.Password;
                HostName.Text = _source.Host;
                Connection.Text = _source.Connection;
                ConnectionType.SelectedValue = _source.ConnectionType.ToString();
                Port.Text = _source.Port;
                RememberPassword.IsChecked = false;
                ProtocolVersion.SelectedValue = _source.ProtocolVersion.ToString();
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
                }
                else
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
            UserName.Text = "";
            Password.Password = "";
            RememberPassword.IsChecked = false;
            _screenInitDone = true;
            ConnectionType.SelectedIndex = 0;
            validateContent();
        }
        private void initComboboxes()
        {
            ConnectionType.ItemsSource = DataSourceOracle.OracleConnectionType.Service.GetFriendlyNames();
            ProtocolVersion.ItemsSource = OracleAllowedLogonVersionClient.Version8.GetFriendlyNames();
        }
        #endregion

        #region ControlEvents
        private void OnControlChanged(object sender, SelectionChangedEventArgs e)
        {
            this.validate(sender);
        }
        private void OnControlChanged(object sender, TextChangedEventArgs e)
        {
            this.validate(sender);
        }
        private void OnControlChanged(object sender, System.Windows.Input.TextCompositionEventArgs e)
        {
            this.validate(sender);
        }
        private void TestConnectionButton_Click(object sender, RoutedEventArgs e)
        {
            this.Source.Validate(true);
        }
        private void OkButton_Click(object sender, RoutedEventArgs e)
        {
            if (this.Source.Validate(false))
            {
                this.DialogResult = true;
            }
        }
        private void CancelButton_Click(object sender, RoutedEventArgs e)
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
                if (cmb.Name == "ConnectionType")
                {
                    string itm = ConnectionType.SelectedItem.ToString();

                    if (!String.IsNullOrEmpty(itm))
                    {
                        txtConnection.Content = itm;
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
            if (String.IsNullOrEmpty(HostName.Text))
            {
                validState = false;
                testState = false;
            }
            if (String.IsNullOrEmpty(Port.Text))
            {
                validState = false;
                testState = false;
            }
            OkButton.IsEnabled = validState;
            TestConnectionButton.IsEnabled = testState;
        }
        private void validateLayout()
        {
            this.validateContent();
        }
        #endregion
    }
}

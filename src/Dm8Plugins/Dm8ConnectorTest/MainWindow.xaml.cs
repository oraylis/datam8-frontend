using System.Text;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Navigation;
using System.Windows.Shapes;
using Dm8LakeConnector;
using Dm8LakeConnector.Views;
using Dm8OracleConnector;
using Oracle.ManagedDataAccess.Client;
using static System.Net.Mime.MediaTypeNames;

namespace Dm8ConnectorTest
{
    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : Window
    {
        public MainWindow()
        {
            InitializeComponent();
        }

        private void EnterSecret_Click(object sender, RoutedEventArgs e)
        {
        //    EnterSecretView win = new EnterSecretView();
        //    win.Title = "Enter Password";
        //    var x = win.ShowDialog();
        //    var p = win.Passwort;

        }

        private void Configure_Click(object sender, RoutedEventArgs e)
        {
            Dm8OracleConnector.Views.ConfigureView win = new Dm8OracleConnector.Views.ConfigureView();
            Dictionary<string, string> ext = new Dictionary<string, string>();
            ext.Add("EncryptedData", "48C083A3-DD72-4FFC-86DF-C3EB6914AF04");
            ext.Add("RememberPassword", "true");
            win.Source = new DataSourceOracle()
            {
                ConnectionString = "Host=aut0ora0dev.westeurope.cloudapp.azure.com;Port=1521;ConnectionType=SID;Connection=oratest2;User=datam8;ProtocolVersion=Version11",
                ExtendedProperties = ext,
            };
            win.DataSourcename = "OracleStorage";

            var x = win.ShowDialog();
            if (x != null)
            {
                var s = win.Source;
                var s1 = s.ConnectionString;
            }
        }

        private void SelectObjects_OnClick_Click(object sender, RoutedEventArgs e)
        {
            Dictionary<string, string> ext = new Dictionary<string, string>();
            ext.Add("EncryptedData", "48C083A3-DD72-4FFC-86DF-C3EB6914AF04");
            ext.Add("RememberPassword", "true");

            DataSourceOracle ds = new DataSourceOracle
            {
                ConnectionString = "Host=aut0ora0dev.westeurope.cloudapp.azure.com;Port=1521;ConnectionType=SID;Connection=oratest2;User=datam8",
                ExtendedProperties = ext,
            };
            Dm8OracleConnector.Dm8OracleConnector con = new Dm8OracleConnector.Dm8OracleConnector()
            {
                Source = ds
            };
            _ = con.SelectObjects(delegate (string dm8l)
            {
                return (true);
            });
        }
    }
}
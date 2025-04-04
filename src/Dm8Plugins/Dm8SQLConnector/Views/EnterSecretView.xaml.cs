using System;
using System.Collections.Generic;
using System.Linq;
using System.Security;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;

namespace Dm8LakeConnector.Views
{
    /// <summary>
    /// Interaction logic for EnterSecretView.xaml
    /// </summary>
    public partial class EnterSecretView : Window
    {
        public EnterSecretView()
        {
            InitializeComponent();
        }

        public string Passwort
        {
            get
            {
                return (SecretInput.Password);
            }
        }
        public SecureString SecurePasswort
        {
            get
            {
                return (SecretInput.SecurePassword);
            }
        }
        private void SecretInput_PasswordChanged(object sender, RoutedEventArgs e)
        {
            OkButton.IsEnabled = (SecretInput.SecurePassword.Length > 0);
        }

        private void CancelButton_Click(object sender, RoutedEventArgs e)
        {
            this.DialogResult = false;
        }

        private void OkButton_Click(object sender, RoutedEventArgs e)
        {
            this.DialogResult = true;
        }
    }
}

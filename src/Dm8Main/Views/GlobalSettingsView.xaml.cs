using System;
using System.Collections.Generic;
using System.Composition;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Navigation;
using System.Windows.Shapes;
using Dm8Main.ViewModels;

namespace Dm8Main.Views
{
    /// <summary>
    /// Interaction logic for GlobalSettings.xaml
    /// </summary>
    public partial class GlobalSettingsView : UserControl, IAnchorView
    {
        [ImportingConstructor]
        public GlobalSettingsView(GlobalSettingsViewModel globalSettingsViewModel)
        {
            this.InitializeComponent();
            this.DataContext = globalSettingsViewModel;
        }

        public AnchorViewModel ViewModel => (GlobalSettingsViewModel)this.DataContext;
    }
}

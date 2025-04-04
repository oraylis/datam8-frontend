using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;
using Dm8Data.Validate;
using Dm8Main.Base;
using Dm8Main.Services;
using Dm8Main.ViewModels;
using Dm8Main.Views;
using Dm8Main.Views.Dialog;
using MvvmDialogs;
using Prism.Ioc;
using Prism.Unity;

namespace Dm8Main
{
    /// <summary>
    /// Interaction logic for App.xaml
    /// </summary>
    public partial class App : PrismApplication
    {
        public static MainWindowViewModel MainWindowViewModel { get; protected set; }

        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);

            // Catch exceptions from a single specific UI dispatcher thread.
            this.DispatcherUnhandledException += (o, e) =>
            {
                if (!Debugger.IsAttached)
                {
                    e.Handled = true;
                }

                if (this.App_UnhandledException(o, e.Exception, true))
                {
                    e.Handled = true;
                }
            };

            // Catch exceptions from all threads in the AppDomain.
            TaskScheduler.UnobservedTaskException += (o, e) =>
            {
                this.App_UnhandledException(o, e.Exception, false);
            };

            // Catch exceptions from each AppDomain that uses a task scheduler for async operations.
            AppDomain.CurrentDomain.UnhandledException += (o, e) =>
            {
                this.App_UnhandledException(o, e.ExceptionObject as Exception, false);
            };

            string dm8s = "";
            for (int i = 0; i != e.Args.Length; ++i)
            {
                if (e.Args[i].ToLower().StartsWith("/dm8s:"))
                {
                    dm8s = e.Args[i].Substring(6);
                }
            }

            if (!String.IsNullOrEmpty(dm8s) && File.Exists((dm8s)))
            {
                _ = MainWindowViewModel.OpenSolutionFile(dm8s);
            }
        }

        private bool App_UnhandledException(object sender, Exception ex, bool promptUserForShutdown)
        {
            var messageBoxTitle = "Unhandled Exception";
            var messageBoxMessage = DialogServiceExt.GetExceptionText(ex);
            var messageBoxButtons = MessageBoxButton.OK;

            if (promptUserForShutdown)
            {
                messageBoxMessage += "\r\nTerminate?";
                messageBoxButtons = MessageBoxButton.YesNo;
            }

            // Let the user decide if the app should die or not (if applicable).
            bool rc = false;
            App.Current.Dispatcher.Invoke(new Action(() =>
            {
                if (MessageBox.Show(App.Current.MainWindow, messageBoxMessage, messageBoxTitle, messageBoxButtons) ==
                    MessageBoxResult.Yes)
                {
                    Current.Shutdown();
                }
                else if (promptUserForShutdown)
                {
                    rc = true;
                }
            }));
            return rc;
        }

        protected override Window CreateShell()
        {
            var mainWindow = this.Container.Resolve<MainWindow>();
            mainWindow.Closed += this.MainWindow_Closed;
            MainWindowViewModel = mainWindow.DataContext as MainWindowViewModel;
            return mainWindow;
        }

        private void MainWindow_Closed(object sender, EventArgs e)
        {
            this.Shutdown();
        }

        protected override void RegisterTypes(IContainerRegistry containerRegistry)
        {
            containerRegistry.RegisterSingleton<ISolutionService, SolutionService>();

            // register other needed services here (should add interface) 
            containerRegistry.RegisterSingleton<GlobalSettingsView>();
            containerRegistry.RegisterSingleton<ProjectView>();
            containerRegistry.RegisterSingleton<GitView>();
            containerRegistry.RegisterSingleton<OutputView>();

            // Register documents and services
            containerRegistry.Register<IDialogService, DialogService>();
            containerRegistry.Register<IDataTypesView, DataTypesView>();
            containerRegistry.Register<IAttributeTypesView, AttributeTypesView>();
            containerRegistry.Register<IDataProductsView, DataProductsView>();
            containerRegistry.Register<IDataSourcesView, DataSourcesView>();
            containerRegistry.Register<ICodeFileView, CodeFileView>();
            containerRegistry.Register<IRawModelEntryView, RawModelEntryView>();
            containerRegistry.Register<IStageEntityView, StageModelEntryView>();
            containerRegistry.Register<ICoreModelEntryView, CoreModelEntryView>();
            containerRegistry.Register<ICuratedModelEntryView, CuratedModelEntryView>();
            containerRegistry.Register<IDiagramView, DiagramView>();
            containerRegistry.Register<IGeneratorFileView, GeneratorFileView>();

            // Register dialogs
            containerRegistry.RegisterDialog<DlgDataSourceEdit>();
            containerRegistry.RegisterDialog<DlgRawModelEntryAdd>();
            containerRegistry.RegisterDialog<DlgCoreAttributeEdit>();
            containerRegistry.RegisterDialog<DlgCoreAttributeAssign>();
        }

        public static void Wait(bool set)
        {
            if (set)
            {
                Application.Current.MainWindow.Cursor = System.Windows.Input.Cursors.Wait;
                Application.Current.MainWindow.CaptureMouse();
            }
            else
            {
                Application.Current.MainWindow.Cursor = System.Windows.Input.Cursors.Arrow;
                Application.Current.MainWindow.ReleaseMouseCapture();
            }
            App.AE();
        }
        public static void AE()
        {
            DispatcherFrame frame = new();
            // DispatcherPriority set to Input, the highest priority
            Dispatcher.CurrentDispatcher.Invoke(DispatcherPriority.Input, new DispatcherOperationCallback(delegate (object parameter)
            {
                frame.Continue = false;
                Thread.Sleep(1); // Stop all processes to make sure the UI update is perform
                return null;
            }), null);
            Dispatcher.PushFrame(frame);
            // DispatcherPriority set to Input, the highest priority
            Application.Current.Dispatcher.Invoke(DispatcherPriority.Input, new Action(delegate { }));
        }
    }
}

using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;
using Dm8Locator;
using Microsoft.SqlServer.TransactSql.ScriptDom;
using MvvmDialogs;

namespace Dm8Main.Base
{
    public static class DialogServiceExt
    {
        public static void ShowException(this IDialogService dialogService, INotifyPropertyChanged owner, Exception ex)
        {
            var rc = GetExceptionText(ex);
            Application.Current.Dispatcher.BeginInvoke(() =>
                {
                    try
                    {
                        dialogService.ShowMessageBox(owner, rc, "Errormessage:1");
                    }
                    catch (ViewNotRegisteredException)
                    {
                        dialogService.ShowMessageBox(Application.Current.MainWindow.DataContext as INotifyPropertyChanged, rc, "Errormessage:2");
                    }

                },
                DispatcherPriority.ApplicationIdle);

        }

        public static string GetExceptionText(Exception ex)
        {
            StringBuilder rc = new StringBuilder();
            string callStackTrace = ex.StackTrace;
            while (ex != null)
            {
                if (ex.GetType() == typeof(InvalidDm8LocatorException))
                {
                    InvalidDm8LocatorException e1 = ex as InvalidDm8LocatorException;
                    rc.AppendLine("Object: " + e1?.InvalidDm8DataLocator);
                }
                rc.AppendLine(ex.Message);

                ex = ex.InnerException;
            }

            rc.AppendLine(callStackTrace);

            return rc.ToString();
        }
    }
}

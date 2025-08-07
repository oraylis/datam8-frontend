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

using System;
using System.ComponentModel;
using System.Text;
using System.Windows;
using System.Windows.Threading;
using Dm8Locator;
using MvvmDialogs;

namespace Dm8Main.Base
{
   public static class DialogServiceExt
   {
      public static void ShowException(this IDialogService dialogService ,INotifyPropertyChanged owner ,Exception ex)
      {
         var rc = GetExceptionText(ex);
         Application.Current.Dispatcher.BeginInvoke(() =>
             {
                try
                {
                   dialogService.ShowMessageBox(owner ,rc ,"Errormessage:1");
                } catch (ViewNotRegisteredException)
                {
                   dialogService.ShowMessageBox(Application.Current.MainWindow.DataContext as INotifyPropertyChanged ,rc ,"Errormessage:2");
                }

             } ,
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

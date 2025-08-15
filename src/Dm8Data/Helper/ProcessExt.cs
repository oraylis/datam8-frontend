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
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Win32;

namespace Dm8Data.Helper
{
   public class ProcessExt
   {
      public static async Task RunAsync(string fileName ,string args ,Action<string> outputFunc ,Action<string> errorFunc = null)
      {
         string exePath = fileName;
         if (!File.Exists(fileName))
         {
            var file = Path.GetFileName(fileName);
            // find path
            var enviromentPath = Environment.GetEnvironmentVariable("PATH");

            var paths = enviromentPath.Split(';');
            exePath = paths.Select(x => Path.Combine(x ,file))
                .Where(x => File.Exists(x))
                .FirstOrDefault();
         }

         if (File.Exists((exePath)))
         {
            ProcessStartInfo info = new ProcessStartInfo(exePath)
            {
               Arguments = args ,
               UseShellExecute = false ,
               RedirectStandardInput = true ,
               RedirectStandardOutput = true ,
               RedirectStandardError = errorFunc != null ? true : false ,
               CreateNoWindow = true
            };

            await Task.Factory.StartNew(() =>
            {
               using Process process = Process.Start(info);
               StreamReader sr = process?.StandardOutput;
               while (!sr.EndOfStream)
               {
                  var line = sr.ReadLine();
                  outputFunc(line);
               }

               if (errorFunc != null)
               {
                  StreamReader serr = process?.StandardError;
                  while (!serr.EndOfStream)
                  {
                     var line = serr.ReadLine();
                     errorFunc(line);
                  }
               }
            });
         }
      }

      public static string DefaultBrowser()
      {
         string browser = string.Empty;

#pragma warning disable

         try
         {

            using var key = Registry.CurrentUser.OpenSubKey(@"SOFTWARE\Microsoft\Windows\Shell\Associations\URLAssociations\http\UserChoice");
            var s = (string)key?.GetValue("ProgId");
            using var command = Registry.ClassesRoot.OpenSubKey($"{s}\\shell\\open\\command");

            browser = (string)command?.GetValue(null);
            browser = browser.Replace(@"\""" ,@"");
            browser = browser.Replace(@"\\" ,@"\");
            browser = browser.Replace('"' ,' ').Trim();
            if (!browser.EndsWith("exe"))
            {
               browser = browser.Substring(0 ,browser.LastIndexOf(".exe" ,StringComparison.InvariantCultureIgnoreCase) + 4);
            }

         }
         finally
         {
         }
#pragma warning enable

         return (browser);
      }

      public static void OpenWebsite(string url)
      {
         using (Process pro = new Process())
         {
            pro.StartInfo.FileName = ProcessExt.DefaultBrowser();
            pro.StartInfo.Arguments = url;
            pro.Start();
         }
      }
   }
}

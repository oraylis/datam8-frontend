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
using System.Configuration;
using WixSharp;

class Script
{
   static public void Main()
   {
      string companyname = ConfigurationManager.AppSettings["Companyname"];
      string productname = ConfigurationManager.AppSettings["Productname"];
      string version = ConfigurationManager.AppSettings["Version"];
      string website = ConfigurationManager.AppSettings["Website"];
      string phone = ConfigurationManager.AppSettings["Phone"];
      string guid = ConfigurationManager.AppSettings["GUID"];
      string icon = ConfigurationManager.AppSettings["Icon"];


      string installPath = @"%LocalAppData%\Programs\" + companyname + @"\" + productname;

      Compiler.AutoGeneration.IgnoreWildCardEmptyDirectories = false;

      Project project =
          new Project(productname ,new InstallDir(new Id("INSTALLDIR") ,installPath ,
              new Files(@"..\Dm8Main\bin\Debug\net8.0-windows7.0\*.*")))
          {
             GUID = new Guid(guid) ,
             Version = new Version(version) ,
             PreserveTempFiles = true ,
             Platform = Platform.x64 ,
             LicenceFile = @"..\..\LICENSE.rtf" ,
             OutDir = @".\bin\Debug" ,
             Scope = InstallScope.perUser ,
             UI = WUI.WixUI_InstallDir ,
             ControlPanelInfo =
              {
                Comments = productname,
                    Readme = website,
                    HelpLink = website,
                    HelpTelephone = phone,
                    UrlInfoAbout = website,
                    UrlUpdateInfo = website,
                    ProductIcon = icon,
                    Contact = companyname,
                    Manufacturer = companyname,
                    InstallLocation = "[INSTALLDIR]",
                    NoModify = true
              } ,
             MajorUpgrade = new MajorUpgrade
             {
                AllowDowngrades = false ,
                AllowSameVersionUpgrades = true ,
                Disallow = false ,
                DowngradeErrorMessage = "A later version of [ProductName] is already installed. Setup will now exit." ,
                IgnoreRemoveFailure = false ,
                Schedule = UpgradeSchedule.afterInstallValidate ,
             } ,
             MajorUpgradeStrategy = new MajorUpgradeStrategy
             {
                RemoveExistingProductAfter = Step.InstallInitialize ,
                UpgradeVersions = VersionRange.ThisAndOlder
             }
          }
      ;

      //project.RemoveDialogsBetween(NativeDialogs.LicenseAgreementDlg, NativeDialogs.VerifyReadyDlg);

      var mp = project.ResolveWildCards();
      var mainExe = mp.FindFirstFile("Dm8Main.exe");

      Console.WriteLine($"Main executable is '{mainExe.ToString()}'");

      Console.WriteLine("Setting shortcuts..");
      mainExe.Shortcuts = new[]
      {
                new FileShortcut(productname, @"%Desktop%"),
                new FileShortcut(productname, @"%ProgramMenu%"),
            };

      Console.WriteLine("Setting files associations..");
      mainExe.Associations = new[]
      {
                new FileAssociation("dm8s") { Description = "DataM8 solution file", ContentType = @"json/dm8s", Arguments = "/dm8s:\"%1\""}
        };

      Console.WriteLine("Building main project...");
      project.BuildMsi();


   }
}
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
using System.Configuration;
using System.IO;
using System.Linq;
using System.Text;
using System.Windows;
using AvalonDock.Layout.Serialization;
using ControlzEx.Theming;
using Dm8Data;
using Dm8Data.Helper;
using Dm8Main.Base;
using Dm8Main.Models;
using Dm8Main.Services;
using Dm8Main.ViewModels;
using Prism.Events;
using Unity;

namespace Dm8Main.Views
{
   /// <summary>
   /// Interaction logic for MainWindow.xaml
   /// </summary>
   public partial class MainWindow:MainWindowBase
   {
      private readonly IEventAggregator _eventAggregator;

      private readonly IUnityContainer _container;

      private readonly ISolutionService _solutionService;

      public MainWindow(IUnityContainer container ,IEventAggregator eventAggregator ,ISolutionService solutionService)
      {
         _container = container;
         _eventAggregator = eventAggregator;
         _solutionService = solutionService;
         _eventAggregator.GetEvent<OpenLayout>().Subscribe((i) => Application.Current.Dispatcher.InvokeAsync(() => this.OpenLayout(i)));
         _eventAggregator.GetEvent<SaveLayout>().Subscribe((i) => Application.Current.Dispatcher.InvokeAsync(() => this.SaveLayout(i)));



         this.InitializeComponent();
         this.SetTheme();
         this.RestoreState(Properties.Settings.Default.MainWindowSetting);

         if ((bool)(ConfigurationManager.AppSettings["GIT Support"]?.ToLower() == "true"))
         {
            this.Git.Visibility = Visibility.Visible;
            this.Git.Width = 80;
            _solutionService.GitActive = true;
         } else
         {
            this.Git.Visibility = Visibility.Hidden;
            this.Git.Width = 0;
            _solutionService.GitActive = false;
         }
      }

      private void MainWindow_OnClosing(object? sender ,CancelEventArgs e)
      {
         Properties.Settings.Default.MainWindowSetting = this.StoreState();
         Properties.Settings.Default.Save();
      }

      private async void OpenLayout(Solution i)
      {
         try
         {
            var serialized = await FileHelper.ReadFileAsync(System.IO.Path.Combine(i.CurrentRootFolder ,"datam8.user") ,true);
            this.OpenLayout(serialized);
         } catch
         {
            this.OpenLayout(Properties.Resources.Layout_Default);
         }
         App.MainWindowViewModel.SetWaitScreen(false);
      }

      private void OpenLayout(string layout)
      {
         var xmlLayoutSerializer = new XmlLayoutSerializer(this.dockManager);
         xmlLayoutSerializer.LayoutSerializationCallback += this.XmlLayoutSerializer_LayoutSerializationCallback;
         using (var stringReader = new StringReader(layout))
         {
            xmlLayoutSerializer.Deserialize(stringReader);
         }
      }


      private void XmlLayoutSerializer_LayoutSerializationCallback(object? sender ,LayoutSerializationCallbackEventArgs e)
      {
         if (e.Model.ContentId == null)
         {
            return;
         }

         if (e.Model.ContentId.StartsWith("Type$"))
         {
            var type = e.Model.ContentId.Replace("Type$" ,"").Replace("ViewModel" ,"View");
            var obj = _container.Registrations.Where(i => i.RegisteredType.Name == type).FirstOrDefault();
            if (obj != null)
            {
               e.Content = MainWindowViewModel.CreateAnchorable(obj.RegisteredType ,_container);
            }
         }

         if (e.Model.ContentId.StartsWith("Item$"))
         {
            // get solution
            var solution = _solutionService.Solution;
            if (solution == null)
            {
               throw new ArgumentNullException(nameof(solution));
            }

            // create project item
            var projType = e.Model.ContentId.Replace("Item$" ,"");
            string relPath = null;
            if (projType.Contains("#"))
            {
               relPath = projType.Substring(projType.IndexOf("#") + 1);
               projType = projType.Substring(0 ,projType.IndexOf("#"));
            }
            ProjectItem.Types t = (ProjectItem.Types)Enum.Parse(typeof(ProjectItem.Types) ,projType);
            var item = ProjectItem.CreateItem(t ,_solutionService ,_eventAggregator ,relPath);
            var view = MainWindowViewModel.CreateDocumentView(item ,_container);
            this.Dispatcher.BeginInvoke(async () =>
            {
               var uglyWorkaround = (this.DataContext as MainWindowViewModel);
               view.ViewModel.ProjectItem = item;
               await view.ViewModel.LoadAsync();
               await uglyWorkaround.OutputErrorsAsync(view.ViewModel);
            });
            e.Content = view;
         }



         return;
      }

      private async void SaveLayout(Solution i)
      {
         var xmlLayoutSerializer = new XmlLayoutSerializer(this.dockManager);
         var stringBuilder = new StringBuilder();
         using (var textWriter = new StringWriter(stringBuilder))
         {
            xmlLayoutSerializer.Serialize(textWriter);
         }

         var serialized = stringBuilder.ToString();
         await FileHelper.WriteFileAsync(System.IO.Path.Combine(i.CurrentRootFolder ,"datam8.user") ,serialized);
      }


      public override void ThemeChanged(DependencyPropertyChangedEventArgs e)
      {
         this.SetTheme();
      }

      private void SetTheme()
      {
         if (this.dockManager != null && this.Theme == ColorTheme.Dark)
         {
            ThemeManager.Current.ChangeTheme(Application.Current ,"Dark.Blue");
            this.dockManager.Theme = new AvalonDock.Themes.Vs2013DarkTheme();
         } else if (this.dockManager != null)
         {
            ThemeManager.Current.ChangeTheme(Application.Current ,"Light.Blue");
            this.dockManager.Theme = new AvalonDock.Themes.Vs2013LightTheme();
         }

         ThemeManager.Current.SyncTheme();
      }

      private void dockManager_ActiveContentChanged(object sender ,EventArgs e)
      {

      }

      private void dockManager_DocumentClosing(object sender ,AvalonDock.DocumentClosingEventArgs e)
      {
         if (this.DocumentClosingCommand != null)
         {
            this.DocumentClosingCommand.Execute(e);
         }
      }

   }
}

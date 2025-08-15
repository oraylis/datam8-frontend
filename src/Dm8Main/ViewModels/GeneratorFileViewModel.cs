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
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Composition;
using System.IO;
using System.Threading.Tasks;
using Dm8Data;
using Dm8Data.Helper;
using Dm8Data.Validate.Exceptions;
using Dm8Main.Base;
using Dm8Main.Models;
using Dm8Main.Services;
using MvvmDialogs;
using Prism.Events;
using Unity;

namespace Dm8Main.ViewModels
{
   [Export]
   public class GeneratorFileViewModel:DocumentViewModelBase
   {
      private readonly IUnityContainer _unityContainer;
      private readonly Solution _solution;

      public GeneratorFileViewModel(IUnityContainer container ,ISolutionService solutionService ,IEventAggregator eventAggregator ,IUnityContainer unityContainer ,IDialogService dialogService)
          : base(solutionService ,eventAggregator ,dialogService)
      {
         this._unityContainer = unityContainer;
         this.dialogService = dialogService;
         this.solutionService = solutionService;

         _solution = this.solutionService.Solution;
         if (_solution == null)
         {
            throw new ArgumentNullException(nameof(_solution));
         }

         this.PropertyChanged += this.GeneratorFileViewModel_PropertyChanged;
         this.ErrorList = new ObservableCollection<ModelReaderException>();
      }

      private void GeneratorFileViewModel_PropertyChanged(object? sender ,System.ComponentModel.PropertyChangedEventArgs e)
      {
         if (e.PropertyName == nameof(this.JsonCode))
         {
            this.IsModified = true;
         }
      }

      private void PublishWithError(ref bool error ,string s ,IList<ModelReaderException> errorList)
      {
         if (s.Contains("error :") || s.Contains("error ") || s.Contains("Exception:"))
         {
            error = true;
            var errorStr = s.Substring(s.IndexOf("error") + 5);
            var source = String.Empty;
            if (errorStr.Contains("Line"))
            {
               source = errorStr.Substring(errorStr.IndexOf("Line"));
               errorStr = errorStr.Replace(source ,"");
            }
            errorList.Add(new GenerateException(errorStr) { Source = source });
         }

         this.eventAggregator.GetEvent<OutputLineEvent>().Publish(new KeyValuePair<string ,string>("Generate" ,s));
      }

      public override void SetSyntaxHighlighting()
      {
         string resource = null;
         if (this.FilePath == null)
         {
            return;
         }

         switch (Path.GetExtension(this.FilePath).ToLower())
         {
            case ".json":
               resource = base.solutionService.Theme == ColorTheme.Dark ? "Dm8Main.Resources.JsonDark.xshd" : "Dm8Main.Resources.JsonLight.xshd";
               break;
            case ".xml":
               resource = base.solutionService.Theme == ColorTheme.Dark ? "Dm8Main.Resources.XMLDark.xshd" : "Dm8Main.Resources.XMLLight.xshd";
               break;
            case ".sql":
               resource = base.solutionService.Theme == ColorTheme.Dark ? "Dm8Main.Resources.TSQLDark.xshd" : "Dm8Main.Resources.TSQLLight.xshd";
               break;
            case ".py":
               resource = base.solutionService.Theme == ColorTheme.Dark ? "Dm8Main.Resources.PythonDark.xshd" : "Dm8Main.Resources.PythonLight.xshd";
               break;
            case ".jinja2":
               resource = base.solutionService.Theme == ColorTheme.Dark ? "Dm8Main.Resources.Jinja2Dark.xshd" : "Dm8Main.Resources.Jinja2Light.xshd";
               break;
            case ".include":
               resource = base.solutionService.Theme == ColorTheme.Dark ? "Dm8Main.Resources.Jinja2Dark.xshd" : "Dm8Main.Resources.Jinja2Light.xshd";
               break;
         }

         if (resource == null)
         {
            return;
         }

         using (var stream = System.Reflection.Assembly.GetExecutingAssembly().GetManifestResourceStream(resource))
         {
            using (var reader = new System.Xml.XmlTextReader(stream))
            {
               this.SyntaxHighlighting =
                   ICSharpCode.AvalonEdit.Highlighting.Xshd.HighlightingLoader.Load(reader ,
                       ICSharpCode.AvalonEdit.Highlighting.HighlightingManager.Instance);
            }
         }
      }


      protected override async Task<bool> LoadInternalAsync()
      {
         this.FilePath = this.ProjectItem.FilePath;
         this.ToolTip = $"{this.ProjectItem.Type} - {this.ProjectItem.Name} ({this.ProjectItem.RelativeFilePath})";
         this.Title = this.ProjectItem.Name;

         var jsonCode = await FileHelper.ReadFileAsync(this.ProjectItem.FilePath);
         if (jsonCode == this.JsonCode)
         {
            return false;
         }
         this.JsonCode = jsonCode;
         this.IsModified = false;
         this.SetSyntaxHighlighting();
         return true;
      }

      protected override async Task SaveInternalAsync()
      {
         // save file
         this.IsSaving = true;
         try
         {
            // reset error list
            this.ErrorList.Clear();

            // save file
            await FileHelper.WriteFileAsync(this.FilePath ,this.JsonCode);
            this.IsModified = false;

            // reload file if no save error
            if (this.ErrorList.Count == 0)
            {
               await this.LoadInternalAsync();
            }
            else
            {
               // check errors
               await this.ValidateAsync();
            }
         }
         catch (Exception ex)
         {
            this.ErrorList.Add(new UnknownValidateException(ex ,this.FilePath));
         }
         finally
         {
            this.IsSaving = false;
         }
      }

      public override async Task SaveAllAsync(IList<ProjectItem> rc)
      {
         try
         {
            await this.SaveAsync();
            rc.Add(this.ProjectItem);
         }
         catch (Exception ex)
         {
            this.dialogService.ShowException(this ,ex);
         }
      }

      public override async Task ValidateAsync()
      {
         await Task.Yield();
      }
   }
}

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
using System.Configuration;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using AvalonDock;
using Dm8Data;
using Dm8Data.Diagram;
using Dm8Data.Helper;
using Dm8Data.MessageOutput;
using Dm8Data.Validate;
using Dm8Main.Base;
using Dm8Main.Properties;
using Dm8Main.Services;
using Dm8Main.Updates;
using Dm8Main.ViewModels.Dialog;
using Dm8Main.Views;
using Dm8Main.Views.Dialog;
using MahApps.Metro.Controls;
using MahApps.Metro.Controls.Dialogs;
using MvvmDialogs;
using MvvmDialogs.FrameworkDialogs.OpenFile;
using MvvmDialogs.FrameworkDialogs.SaveFile;
using Newtonsoft.Json;
using Prism.Commands;
using Prism.Events;
using PropertyTools.Wpf;
using Unity;
using DelegateCommand = Prism.Commands.DelegateCommand;
using ProjectItem = Dm8Main.Models.ProjectItem;

namespace Dm8Main.ViewModels
{
   #region Pragma
#pragma warning disable CS1998
#pragma warning disable CS8618
#pragma warning disable CS8602
#pragma warning disable CS8629
#pragma warning disable CS8600
#pragma warning disable CS8601
   #endregion


   [Export]
   public class MainWindowViewModel:Prism.Mvvm.BindableBase
   {
      private readonly IUnityContainer unityContainer;

      private readonly IDialogService dialogService;

      private readonly IEventAggregator eventAggregator;

      private string Title_Main => ($"{Resources.Title_Main} ({ConfigurationManager.AppSettings["Version"]})");

      private enum GeneratorType
      {
         Stage,
         Output
      }

      #region Property AnchorablesSources
      public ObservableCollection<IAnchorView> Anchorables
      {
         get => this.anchorables;
         set => this.SetProperty(ref this.anchorables ,value);
      }

      private ObservableCollection<IAnchorView> anchorables;
      #endregion

      #region Property Documents
      public ObservableCollection<IDocumentView> Documents
      {
         get => this.documents;
         set => this.SetProperty(ref this.documents ,value);
      }

      private ObservableCollection<IDocumentView> documents;
      #endregion

      #region Property ActiveContent
      public object ActiveContent
      {
         get => this.activeContent;
         set => this.SetProperty(ref this.activeContent ,value);
      }

      private object activeContent;
      #endregion

      #region Property SolutionService
      public ISolutionService SolutionService
      {
         get => this.solutionService;
         set => this.SetProperty(ref this.solutionService ,value);
      }

      private ISolutionService solutionService;
      #endregion

      #region Property ActivateSettingsCommand
      public DelegateCommand ActivateSettingsCommand
      {
         get => this.activateSettingsCommand;
         set => this.SetProperty(ref this.activateSettingsCommand ,value);
      }

      private DelegateCommand activateSettingsCommand;
      #endregion

      #region Property ActivateHelpCommand
      public DelegateCommand ActivateHelpCommand
      {
         get => this.activateHelpCommand;
         set => this.SetProperty(ref this.activateHelpCommand ,value);
      }

      private DelegateCommand activateHelpCommand;
      #endregion

      #region Property ActivateProjectCommand
      public DelegateCommand ActivateProjectCommand
      {
         get => this.activateProjectCommand;
         set => this.SetProperty(ref this.activateProjectCommand ,value);
      }

      private DelegateCommand activateProjectCommand;
      #endregion

      #region Property ActivateOutputCommand
      public DelegateCommand ActivateOutputCommand
      {
         get => this.activateOutputCommand;
         set => this.SetProperty(ref this.activateOutputCommand ,value);
      }

      private DelegateCommand activateOutputCommand;
      #endregion

      #region Property ActivateGitCommand
      public DelegateCommand ActivateGitCommand
      {
         get => this.activateGitCommand;
         set => this.SetProperty(ref this.activateGitCommand ,value);
      }

      private DelegateCommand activateGitCommand;
      #endregion

      #region Property GenerateStageCommand
      public DelegateCommand GenerateStageCommand
      {
         get => _generateStageCommand;
         set => this.SetProperty(ref _generateStageCommand ,value);
      }

      private DelegateCommand _generateStageCommand;
      #endregion

      #region Property GenerateOutputCommand
      public DelegateCommand GenerateOutputCommand
      {
         get => _generateOutputCommand;
         set => this.SetProperty(ref _generateOutputCommand ,value);
      }

      private DelegateCommand _generateOutputCommand;
      #endregion

      #region Property DocumentClosingCommand
      public DelegateCommand<DocumentClosingEventArgs> DocumentClosingCommand
      {
         get => this.documentClosingCommand;
         set => this.SetProperty(ref this.documentClosingCommand ,value);
      }

      public DelegateCommand<DocumentClosingEventArgs> documentClosingCommand;
      #endregion

      #region Property NewCommand
      public DelegateCommand NewCommand
      {
         get => this.newCommand;
         set => this.SetProperty(ref this.newCommand ,value);
      }

      private DelegateCommand newCommand;
      #endregion

      #region Property OpenCommand
      public DelegateCommand OpenCommand
      {
         get => this.openCommand;
         set => this.SetProperty(ref this.openCommand ,value);
      }

      private DelegateCommand openCommand;
      #endregion

      #region Property SaveCommand
      public DelegateCommand SaveCommand
      {
         get => this.saveCommand;
         set => this.SetProperty(ref this.saveCommand ,value);
      }

      private DelegateCommand saveCommand;
      #endregion

      #region Property SaveAllCommand
      public DelegateCommand SaveAllCommand
      {
         get => this.saveAllCommand;
         set => this.SetProperty(ref this.saveAllCommand ,value);
      }

      private DelegateCommand saveAllCommand;
      #endregion

      #region Property ValidateCommand
      public DelegateCommand ValidateCommand
      {
         get => this.validateCommand;
         set => this.SetProperty(ref this.validateCommand ,value);
      }

      private DelegateCommand validateCommand;
      #endregion

      #region Property AddSourceCommand
      public DelegateCommand AddSourceCommand
      {
         get => this.addSourceCommand;
         set => this.SetProperty(ref this.addSourceCommand ,value);
      }

      private DelegateCommand addSourceCommand;
      #endregion

      #region Property RefreshSourceCommand
      public DelegateCommand RefreshSourceCommand
      {
         get => this.refreshSourceCommand;
         set => this.SetProperty(ref this.refreshSourceCommand ,value);
      }

      private DelegateCommand refreshSourceCommand;
      #endregion

      #region Property AddCoreCommand
      public DelegateCommand AddCoreCommand
      {
         get => this.addCoreCommand;
         set => this.SetProperty(ref this.addCoreCommand ,value);
      }

      private DelegateCommand addCoreCommand;
      #endregion

      #region Property AddCuratedCommand
      public DelegateCommand AddCuratedCommand
      {
         get => this.addCuratedCommand;
         set => this.SetProperty(ref this.addCuratedCommand ,value);
      }
      private DelegateCommand addCuratedCommand;
      #endregion

      #region Property Title
      public string Title
      {
         get => this.title;
         set => this.SetProperty(ref this.title ,value);
      }

      private string title;
      #endregion

      #region Property Zoom
      public double Zoom
      {
         get => this.zoom;
         set => this.SetProperty(ref this.zoom ,value);
      }

      private double zoom;
      #endregion

      #region Property ProjectItem
      public ProjectItem ProjectItem
      {
         get => this.projectItem;
         set => this.SetProperty(ref this.projectItem ,value);
      }

      private ProjectItem projectItem;
      #endregion

      #region Property IsSolutionOpen
      public bool IsSolutionOpen
      {
         get => this.isSolutionOpen;
         set => this.SetProperty(ref this.isSolutionOpen ,value);
      }

      private bool isSolutionOpen;
      #endregion

      #region Property IsDocumentActive
      public bool IsDocumentActive
      {
         get => this.isDocumentActive;
         set => this.SetProperty(ref this.isDocumentActive ,value);
      }

      private bool isDocumentActive;
      #endregion

      #region ProjectTree
      private TreeListBox? ProjectTree
      {
         get
         {
            foreach (var item in this.Anchorables)
            {
               if (item is ProjectView projectView)
               {
                  return (projectView.projectTree);
               }
            }
            return null;
         }
      }
      #endregion
      private ProjectView? GetProjectView
      {
         get
         {
            foreach (var item in this.Anchorables)
            {
               if (item is ProjectView projectView)
               {
                  return (projectView);
               }
            }
            return null;
         }
      }

      public string GenerateStageName
      {
         get => _generateStageName;
         set => this.SetProperty(ref _generateStageName ,value);
      }
      private string _generateStageName;

      public string AddCoreName
      {
         get => _addCoreName;
         set => this.SetProperty(ref _addCoreName ,value);
      }
      private string _addCoreName;
      public string AddRawName
      {
         get => _addRawName;
         set => this.SetProperty(ref _addRawName ,value);
      }
      private string _addRawName;
      public string RefreshRawName
      {
         get => _refreshRawName;
         set => this.SetProperty(ref _refreshRawName ,value);
      }
      private string _refreshRawName;
      public string RawGroupName
      {
         get => _rawGroupName;
         set => this.SetProperty(ref _rawGroupName ,value);
      }
      private string _rawGroupName;
      public string CoreGroupName
      {
         get => _coreGroupName;
         set => this.SetProperty(ref _coreGroupName ,value);
      }
      private string _coreGroupName;
      public string GenerateGroupName
      {
         get => _generateGroupName;
         set => this.SetProperty(ref _generateGroupName ,value);
      }
      private string _generateGroupName;

      public MainWindowViewModel(IUnityContainer container ,
                                 IEventAggregator eventAggregator ,
                                 IDialogService dialogService ,
                                 ISolutionService solutionService
                                 )
      {
         this.unityContainer = container;
         this.eventAggregator = eventAggregator;
         this.eventAggregator.GetEvent<SelectDocumentEvent>().Subscribe((i) => Application.Current.Dispatcher.InvokeAsync(() => this.SelectDocument(i)));
         this.eventAggregator.GetEvent<OpenDocumentEvent>().Subscribe((i) => Application.Current.Dispatcher.InvokeAsync(() => this.OpenDocument(i)));
         this.eventAggregator.GetEvent<EditObjectNameEvent>().Subscribe((i) => Application.Current.Dispatcher.InvokeAsync(() => this.EditDocumentName(i)));
         this.eventAggregator.GetEvent<RenameObjectEvent>().Subscribe((i) => Application.Current.Dispatcher.InvokeAsync(() => this.RenameDocumentEvent(i)));
         this.eventAggregator.GetEvent<DeleteObjectEvent>().Subscribe((i) => Application.Current.Dispatcher.InvokeAsync(() => this.DeleteObject(i)));
         this.eventAggregator.GetEvent<OpenDocumentsEvent>().Subscribe((i) => Application.Current.Dispatcher.InvokeAsync(() => this.OpenDocuments()));
         this.eventAggregator.GetEvent<NewDocumentEvent>().Subscribe((kv) => Application.Current.Dispatcher.InvokeAsync(() => this.NewDocument(kv)));
         this.eventAggregator.GetEvent<FileChangeEvent>().Subscribe((evt) => Application.Current.Dispatcher.InvokeAsync(() => this.OnFileChangedAsync(evt)));
         this.eventAggregator.GetEvent<DocumentSelectedEvent>().Subscribe((i) => Application.Current.Dispatcher.InvokeAsync(() => this.SetProjectTreeForWindow(i)));




         this.dialogService = dialogService;
         this.SolutionService = solutionService;

         this.PropertyChanged += this.MainViewModel_PropertyChanged;

         this.NewCommand = new DelegateCommand(async () => await this.NewSolutionAsync());
         this.OpenCommand = new DelegateCommand(async () => await this.OpenSolutionAsync());
         this.SaveCommand = new DelegateCommand(async () => await this.SaveAsync());
         this.SaveAllCommand = new DelegateCommand(async () => await this.SaveAllAsync());
         this.ValidateCommand = new DelegateCommand(async () => await this.solutionService.SolutionHelper.CreateAndValidateAsync());
         this.GenerateStageCommand = new DelegateCommand(async () => await this.GenerateStage());
         this.GenerateOutputCommand = new DelegateCommand(async () => await this.GenerateOutput());
         this.DocumentClosingCommand = new DelegateCommand<DocumentClosingEventArgs>(this.DocumentClosing);
         this.ActivateProjectCommand = new DelegateCommand(this.Activate<ProjectView>);
         this.ActivateOutputCommand = new DelegateCommand(this.Activate<OutputView>);
         this.ActivateSettingsCommand = new DelegateCommand(this.Activate<GlobalSettingsView>);
         this.ActivateGitCommand = new DelegateCommand(this.Activate<GitView>);
         this.AddSourceCommand = new DelegateCommand(this.AddRawEntity);
         this.AddCoreCommand = new DelegateCommand(this.AddCoreEntity);
         this.AddCuratedCommand = new DelegateCommand(this.AddCuratedEntity);
         this.RefreshSourceCommand = new DelegateCommand(this.RefreshSource);
         this.ActivateHelpCommand = new DelegateCommand(async () => await this.OpenHelp());

         this.Anchorables = new ObservableCollection<IAnchorView>();
         this.Documents = new ObservableCollection<IDocumentView>();

         this.IsSolutionOpen = false;
         this.IsDocumentActive = false;
         this.Title = this.Title_Main;
         this.Zoom = 1.0;

         this.GenerateStageName = "Generate Stage";
         this.AddCoreName = "Add Core";
         this.AddRawName = "Add Raw";
         this.RefreshRawName = "Refresh Raw";
         this.RawGroupName = "Raw";
         this.CoreGroupName = "Core";
         this.GenerateGroupName = "Stage";

      }
      public static IDocumentView CreateDocumentView(ProjectItem item ,IUnityContainer unityContainer)
      {
         var mainWindowViewModel = App.MainWindowViewModel;
         string viewName = item.Name;
         IDocumentView documentView = null;
         switch (item.Type)
         {
            case ProjectItem.Types.Folder:
            case ProjectItem.Types.RawSubFolder:
            case ProjectItem.Types.GenerateSubFolder:
               break;

            case ProjectItem.Types.DataTypes:
               documentView = unityContainer.Resolve<IDataTypesView>();
               break;

            case ProjectItem.Types.AttributeTypes:
               documentView = unityContainer.Resolve<IAttributeTypesView>();
               break;

            case ProjectItem.Types.DataProducts:
               documentView = unityContainer.Resolve<IDataProductsView>();
               break;


            case ProjectItem.Types.DataSources:
               documentView = unityContainer.Resolve<IDataSourcesView>();
               break;

            case ProjectItem.Types.RawEntity:
               documentView = unityContainer.Resolve<IRawModelEntryView>();
               break;

            case ProjectItem.Types.StagingEntity:
               documentView = unityContainer.Resolve<IStageEntityView>();
               break;

            case ProjectItem.Types.CoreEntity:
               documentView = unityContainer.Resolve<ICoreModelEntryView>();
               break;

            case ProjectItem.Types.CuratedEntity:
               documentView = unityContainer.Resolve<ICuratedModelEntryView>();
               break;

            case ProjectItem.Types.DiagramFile:
               documentView = unityContainer.Resolve<IDiagramView>();
               break;

            case ProjectItem.Types.GenerateFilePython:
            case ProjectItem.Types.GenerateJinja2:
               documentView = unityContainer.Resolve<IGeneratorFileView>();
               break;

            case ProjectItem.Types.CodeFile:
               documentView = unityContainer.Resolve<ICodeFileView>();
               break;
         }

         if (documentView != null)
         {
            documentView.ViewModel.Closed += () => { mainWindowViewModel.Documents.Remove(documentView); };
            mainWindowViewModel.Documents.Add(documentView);
         }
         return documentView;
      }


      public static IAnchorView CreateAnchorable(Type t ,IUnityContainer unityContainer)
      {
         var item = unityContainer.Resolve(t) as IAnchorView;
         item.ViewModel.Closed += () => { App.MainWindowViewModel.Anchorables.Remove(item); };
         App.MainWindowViewModel.Anchorables.Add(item);
         return item;
      }


      public void Activate<T>() where T : IAnchorView
      {
         // fix current state in case of error (shoul not happen)
         IAnchorView item = this.Anchorables.OfType<T>().FirstOrDefault();
         if (item == null)
         {
            item = CreateAnchorable(typeof(T) ,this.unityContainer);
         }
         this.ActiveContent = item;
      }

      private async Task NewSolutionAsync()
      {
         this.Title = this.Title_Main;
         var saveDialogSettings = new SaveFileDialogSettings();
         saveDialogSettings.Title = Resources.Title_CreateSolution;
         saveDialogSettings.OverwritePrompt = true;
         saveDialogSettings.Filter = "DataM8-Solutions (*.dm8s)|*.dm8s|Json Files (*.json)|*.json";
         saveDialogSettings.FileName = "DataM8 Solution.dm8s";
         if (this.dialogService.ShowSaveFileDialog(this ,saveDialogSettings) ?? false)
         {
            // target file/folder
            string fileName = saveDialogSettings.FileNames[0];

            // copy folder
            var solutionTargetPath = fileName;
            var solutionTargetDir = Path.GetDirectoryName(fileName);
            var solutionTargetFile = Path.GetFileName(fileName);
            var emptyPath = Path.Combine(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location) ,"Solution" ,"CreateNewProject");
            foreach (var srcPath in Directory.EnumerateFiles(emptyPath ,"*" ,SearchOption.AllDirectories))
            {
               // source and target filename
               string trgPath = srcPath.Replace(emptyPath ,solutionTargetDir ,
                   StringComparison.InvariantCultureIgnoreCase);
               string trgDir = Path.GetDirectoryName(trgPath);
               string trgFile = Path.GetFileName(trgPath);
               string trgExt = Path.GetExtension(trgPath).ToLower();

               // create directory
               if (!Directory.Exists(trgDir))
               {
                  Directory.CreateDirectory(trgDir);
               }

               // skip dummy files
               if (trgFile == "__dummy__")
               {
                  continue;
               }

               if (trgExt == ".dm8s")
               {
                  trgPath = solutionTargetPath;
               }

               if (FileHelper.IsBinary(srcPath))
               {
                  File.Copy(srcPath ,trgPath);

               } else
               {

                  // read src file
                  var content = await File.ReadAllTextAsync(srcPath);

                  // replace placeholders
                  content = content.Replace("${SolutionName}" ,solutionTargetFile.Replace(".dm8s" ,""));

                  // write target
                  await File.WriteAllTextAsync(trgPath ,content);
               }
            }

            // open solution
            await this.OpenSolutionFile(solutionTargetPath);
         }
      }

      private async Task OpenSolutionAsync()
      {
         // Close Solution (?)

         this.Title = this.Title_Main;
         var openDialogSettings = new OpenFileDialogSettings();
         openDialogSettings.Title = Resources.Title_OpenSolution;
         openDialogSettings.Multiselect = false;
         openDialogSettings.Filter = "DataM8-Solutions (*.dm8s)|*.dm8s|Json Files (*.json)|*.json";
         if (this.dialogService.ShowOpenFileDialog(this ,openDialogSettings) ?? false)
         {
            string fileName = openDialogSettings.FileNames[0];
            if (Path.GetFileName(fileName).ToLower() == "datam8.json")
            {
               string newFile = Path.Combine(Path.GetDirectoryName(fileName) ,"DataM8 Solution.dm8s");
               File.Move(fileName ,newFile);
               fileName = newFile;

            }
            await this.OpenSolutionFile(fileName);
         }
      }

      public async Task OpenSolutionFile(string fileName)
      {
         App.MainWindowViewModel.SetWaitScreen(true);
         string solutionContent = await FileHelper.ReadFileAsync(fileName);

         bool reWriteFile = false;
         Solution solution = CheckDefaultEntries.Solution(solutionContent ,ref reWriteFile);

         solution.SolutionFile = fileName;
         solution.CurrentRootFolder = Path.GetDirectoryName(fileName);

         if (reWriteFile)
         {
            await FileHelper.WriteFileAsync(fileName ,FileHelper.MakeJson(solution));
            SolutionHelper.DeleteIndexFile(solution.CurrentRootFolder);
         }


         // call open solution
         this.eventAggregator.GetEvent<OpenSolution>().Publish(solution);

         // set title
         this.Title = $"{this.Title_Main}: {solution.Name}";
         this.IsSolutionOpen = true;
         this.RefreshMenu(solution);
      }

      public void RefreshMenu(Solution solution)
      {
         this.GenerateStageName = $"Generate {solution.AreaTypes.Stage}";
         this.AddCoreName = $"Add {solution.AreaTypes.Core}";
         this.AddRawName = $"Add {solution.AreaTypes.Raw}";
         this.RefreshRawName = $"Refresh {solution.AreaTypes.Raw}";
         this.CoreGroupName = solution.AreaTypes.Core;
         this.RawGroupName = solution.AreaTypes.Raw;
         this.GenerateGroupName = solution.AreaTypes.Stage;
      }

      private async Task NewDocument(KeyValuePair<ProjectItem ,ProjectItem.Types> kv)
      {
         ProjectItem item = kv.Key;
         ProjectItem.Types newType = kv.Value;
         string path = item.FilePath + Path.DirectorySeparatorChar;


         switch (newType)
         {
            case ProjectItem.Types.RawFolder:
               this.AddRawEntity();
               break;

            case ProjectItem.Types.CoreFolder:
               this.AddCoreEntity();
               break;

            case ProjectItem.Types.CuratedFolder:
               this.AddCuratedEntity();
               break;

            case ProjectItem.Types.DiagramFolder:
               await this.AddDiagramFileAsync(path);
               break;


            case ProjectItem.Types.GenerateSubFolder:
               {
                  int c = Directory.GetFiles(path ,"NewFolder*").Count() + 1;
                  string targetFolder = Path.Combine(path ,$"NewFolder{c}");
                  Directory.CreateDirectory(targetFolder);
                  this.eventAggregator.GetEvent<SaveSolution>().Publish(this.SolutionService.Solution);
                  //var projectItem = ProjectItem.CreateItem(ProjectItem.Types.GenerateSubFolder, this.SolutionService,
                  //    this.eventAggregator, targetFolder.Replace(this.SolutionService.Solution.GenerateFolderPath, ""));
               }
               break;

            case ProjectItem.Types.GenerateFilePython:
               {
                  string content = await FileHelper.ReadFileAsync(Path.Combine(
                      Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location) ,"Solution" ,"NewFile" ,"generate.py"));
                  int c = Directory.GetFiles(path ,"NewGenerate*.py")
                  .Count() + 1;
                  string targetFile = Path.Combine(path ,$"NewGenerate{c}.py");
                  await FileHelper.WriteFileAsync(targetFile ,content);

                  this.eventAggregator.GetEvent<SaveSolution>().Publish(this.SolutionService.Solution);

                  var projectItem = ProjectItem.CreateItem(ProjectItem.Types.GenerateFilePython ,this.SolutionService ,
                      this.eventAggregator ,targetFile.Replace(this.SolutionService.Solution.GenerateFolderPath + Path.DirectorySeparatorChar ,""));
                  await this.OpenDocument(projectItem);
               }
               break;
            case ProjectItem.Types.GenerateJinja2:
               {
                  string content = await FileHelper.ReadFileAsync(Path.Combine(
                      Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location) ,"Solution" ,"NewFile" ,"generate.jinja2"));

                  int c = Directory.GetFiles(path ,"NewGenerate*.jinja2")
                      .Count() + 1;
                  string targetFile = Path.Combine(path ,
                      $"NewGenerate{c}.jinja2");
                  await FileHelper.WriteFileAsync(targetFile ,content);
                  this.eventAggregator.GetEvent<SaveSolution>().Publish(this.SolutionService.Solution);
                  var projectItem = ProjectItem.CreateItem(ProjectItem.Types.GenerateJinja2 ,this.SolutionService ,
                      this.eventAggregator ,
                      targetFile.Replace(
                          this.SolutionService.Solution.GenerateFolderPath + Path.DirectorySeparatorChar ,""));
                  await this.OpenDocument(projectItem);
               }
               break;
         }

         await Task.Yield();
      }

      private async Task SelectDocument(ProjectItem item)
      {
         try
         {
            // change to FilePath
            var openDoc = this.documents.FirstOrDefault(d => d.ViewModel.FilePath == item.FilePath);
            if (openDoc != null)
            {
               this.ActiveContent = openDoc;
            }
         } catch (Exception ex)
         {
            this.dialogService.ShowException(this ,ex);
         }
         await Task.Yield();
      }
      private async Task OpenDocument(ProjectItem item ,bool activate = true)
      {
         try
         {
            // change to FilePath
            var openDoc = this.documents.FirstOrDefault(d => d.ViewModel.FilePath == item.FilePath);
            if (openDoc != null)
            {
               if (activate)
               {
                  this.ActiveContent = openDoc;
               }
               return;
            }
            if (item.IsFolder)
               return;
            var documentView = CreateDocumentView(item ,this.unityContainer);
            if (documentView == null)
            {
               dialogService.ShowMessageBox(this ,$"No document view defined for {item}");
               return;
            }
            documentView.ViewModel.ProjectItem = item;
            await documentView.ViewModel.LoadAsync();
            await this.OutputErrorsAsync(documentView.ViewModel);
            if (activate)
            {
               this.ActiveContent = documentView;
            }
         } catch (Exception ex)
         {
            this.dialogService.ShowException(this ,ex);
         }
      }
      private async Task OpenDocuments()
      {
         try
         {
            ProjectItem last = null;

            List<ProjectItem> lst = new List<ProjectItem>();

            foreach (ProjectItem item in this.ProjectTree?.SelectedItems)
            {
               lst.Add(item);
            }
            this.ProjectTree.UnselectAll();

            foreach (var itm in lst)
            {
               if (itm is ProjectItem projectItm && !projectItm.IsFolder)
               {
                  last = projectItm;
                  await this.OpenDocument(projectItm ,false);
               }
            }
            await this.OpenDocument(last ,true);
         } catch (Exception ex)
         {
            this.dialogService.ShowException(this ,ex);
         }
      }
      private async Task GenerateStage()
      {
         await this.Generate(GeneratorType.Stage);
      }
      private async Task GenerateOutput()
      {
         await this.Generate(GeneratorType.Output);
      }
      private async Task Generate(GeneratorType type)
      {
         App.Wait(true);
         await SaveAllAsync();
         var args = "";
         switch (type)
         {
            case GeneratorType.Stage:
               args = this.SolutionService.GeneratorParameterStage;
               break;
            case GeneratorType.Output:
               args = this.SolutionService.GeneratorParameterOutput;
               break;
         }
         var execPath = Path.Combine(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location));
         args = args.Replace("${ExecPath}" ,execPath);
         args = args.Replace("${SolutionFilePath}" ,this.SolutionService.Solution.SolutionFile);
         args = args.Replace("${SolutionPath}" ,Path.GetDirectoryName(this.SolutionService.Solution.SolutionFile));
         args = args.Replace("${GeneratePath}" ,this.SolutionService.Solution.GenerateFolderPath);
         args = args.Replace("${OutputFolderPath}" ,this.SolutionService.Solution.OutputFolderPath);
         args = args.Replace("${StagingPath}" ,this.SolutionService.Solution.StagingFolderPath);

         ProcessStartInfo info = new ProcessStartInfo(Path.Combine(execPath ,"Generator" ,"python.exe"));
         info.Arguments = "-m dm8data " + args; //Python Module for the generator
         info.WorkingDirectory = execPath;
         info.UseShellExecute = false;
         info.RedirectStandardInput = false;
         info.RedirectStandardOutput = false; //true ;
         info.RedirectStandardError = true; //true ;
         info.CreateNoWindow = false;
         info.WindowStyle = ProcessWindowStyle.Normal;

         // clean generate output
         this.eventAggregator.GetEvent<OutputLineEvent>().Publish(new KeyValuePair<string ,string>("Generate" ,null));

         // dump command line
         string pwd = $"WorkingDirectory: {info.WorkingDirectory}";
         this.eventAggregator.GetEvent<OutputLineEvent>().Publish(new KeyValuePair<string ,string>(Properties.Resources.OutputViewModel_Generate ,pwd));
         string cmd = $"Cmd: {info.FileName} {info.Arguments}";
         this.eventAggregator.GetEvent<OutputLineEvent>().Publish(new KeyValuePair<string ,string>(Properties.Resources.OutputViewModel_Generate ,cmd));

         if (type == GeneratorType.Stage)
         {
            this.eventAggregator.GetEvent<OutputLineEvent>().Publish(
                new KeyValuePair<string ,string>(Properties.Resources.OutputViewModel_Generate ,
                    "Disabling FileWatcher..."));
            this.SolutionService.WatcherEnable = false;
         }
         DateTime dauer = DateTime.Now;
         // call command line tool
         Exception exception = null;
         bool oldStyle = true;
         try
         {
            //await Task.Factory.StartNew(() =>
            //{
            using (Process process = Process.Start(info))
            {
               this.eventAggregator.GetEvent<OutputLineEvent>().Publish(new KeyValuePair<string ,string>(Properties.Resources.OutputViewModel_Generate ,"Generating..."));
               StringBuilder sb = new StringBuilder();
               StreamReader sr = process?.StandardError;
               while (!sr.EndOfStream)
               {
                  var data = sr?.ReadToEnd();
                  data = data.Replace("u001b" ,"").Replace("[0m" ,"").Replace("[92m" ,"").Replace("[91m" ,"");
                  if (oldStyle)
                  {
                     this.eventAggregator.GetEvent<OutputLineEvent>().Publish(new KeyValuePair<string ,string>(Properties.Resources.OutputViewModel_Generate ,data));
                     Thread.Yield();
                  } else
                  {
                     sb.Append(data);
                  }
               }
               if (!oldStyle)
               {
                  this.eventAggregator.GetEvent<OutputLineEventEx>().Publish(new KeyValuePair<string ,StringBuilder>(Properties.Resources.OutputViewModel_Generate ,sb));
                  App.AE();
               }
               if (!process.HasExited)
               {
                  process.WaitForExit();
               }
            }
            //});
         } catch (Exception ex)
         {
            exception = ex;
         }


         if (type == GeneratorType.Stage)
         {
            this.eventAggregator.GetEvent<OutputLineEvent>().Publish(
                new KeyValuePair<string ,string>(Properties.Resources.OutputViewModel_Generate ,
                    "Enabling FileWatcher..."));
            this.SolutionService.WatcherEnable = true;
         }

         await this.solutionService.SolutionHelper.CreateAndValidateAsync();
         this.eventAggregator.GetEvent<SaveSolution>().Publish(this.SolutionService.Solution);

         this.eventAggregator.GetEvent<OutputLineEvent>()
             .Publish(new KeyValuePair<string ,string>(Properties.Resources.OutputViewModel_Generate ,
                 "===Finished=== (" + (DateTime.Now - dauer).ToString() + "s)"));
         App.Wait(false);
         if (exception != null)
         {
            throw exception;
         }
      }
      public async Task OutputErrorsAsync(DocumentViewModelBase documentViewModel)
      {
         // Clear Output
         this.eventAggregator.GetEvent<OutputItemClearEvent>().Publish(documentViewModel.FilePath);

         // Add Exceptions
         if (documentViewModel.ErrorList != null)
         {
            foreach (var validateException in documentViewModel.ErrorList)
            {
               // set Filepath in case not set
               validateException.FilePath = documentViewModel.FilePath;
               this.eventAggregator.GetEvent<OutputItemEvent>().Publish(new OutputItem(validateException ,this.solutionService.Solution));
            }
         }

         await Task.Yield();
      }

      private async Task EditDocumentName(ProjectItem item)
      {
         //this.ProjectTree.SelectedItem = item;
         item.EditItemStart();
         await Task.Yield();
      }

      private void RenameDocumentEvent(RenameObjectArgs args)
      {
         var renamedDoc = this.Documents.Where(doc => doc.ViewModel.FilePath == args.OriginalFilePath).FirstOrDefault();
         if (renamedDoc != null)
         {
            renamedDoc.ViewModel.ProjectItem = args.ProjectItem;
            renamedDoc.ViewModel.FilePath = args.ProjectItem.FilePath;
            renamedDoc.ViewModel.Title = Path.GetFileName(args.ProjectItem.FilePath);
         }
      }

      private async Task DeleteObject(ProjectItem item)
      {
         try
         {
            List<ProjectItem> itemList = new List<ProjectItem>();
            List<ProjectItem> folderList = new List<ProjectItem>();

            foreach (var itm in this.ProjectTree?.SelectedItems)
            {
               if (itm is ProjectItem projectItm)
               {
                  if (projectItm.Type == ProjectItem.Types.GenerateSubFolder)
                  {
                     folderList.Add(projectItm);
                  } else
                  {
                     if (projectItm.CanDelete)
                     {
                        itemList.Add(projectItm);
                     }
                  }
               }
            }

            if (itemList.Count >= 1 || folderList.Count >= 1)
            {
               string msg = "";
               string caption = "";
               if (folderList.Count > 0)
               {
                  caption = Resources.Menu_DeleteFolder;
                  if (folderList.Count == 1)
                  {
                     msg = string.Format(Resources.Message_DeleteFolder ,folderList[0].Name);
                  } else
                  {
                     msg = string.Format(Resources.Message_DeleteFolders ,folderList.Count);
                  }
                  if (this.dialogService.ShowMessageBox(this ,msg ,caption ,System.Windows.MessageBoxButton.YesNo) != MessageBoxResult.Yes)
                  {
                     folderList.Clear();
                  }
               }

               if (itemList.Count > 0)
               {
                  caption = Resources.Menu_DeleteFile;
                  if (itemList.Count == 1)
                  {
                     msg = string.Format(Resources.Message_DeleteFile ,itemList[0].Name);
                  } else
                  {
                     msg = string.Format(Resources.Message_DeleteFiles ,itemList.Count);
                  }
                  if (this.dialogService.ShowMessageBox(this ,msg ,caption ,System.Windows.MessageBoxButton.YesNo) != MessageBoxResult.Yes)
                  {
                     itemList.Clear();
                  }
               }

               if (itemList.Count >= 1 || folderList.Count >= 1)
               {
                  foreach (ProjectItem itm in itemList)
                  {
                     var openDoc = this.documents.Where(d => d.ViewModel.FilePath == itm.FilePath).FirstOrDefault();
                     if (openDoc != null)
                     {
                        this.documents.Remove(openDoc);
                     }
                     File.Delete(itm.FilePath);
                  }
                  foreach (ProjectItem itm in folderList)
                  {
                     if (Directory.Exists(itm.FilePath))
                     {
                        Directory.Delete(itm.FilePath);
                     }
                  }
                  await this.solutionService.SolutionHelper.CreateAndValidateAsync();
                  this.eventAggregator.GetEvent<SaveSolution>().Publish(this.SolutionService.Solution);
                  this.eventAggregator.GetEvent<RefreshSolution>().Publish(this.SolutionService.Solution);
               }
            }
         } catch (Exception ex)
         {
            this.dialogService.ShowException(this ,ex);
         }
      }

      private async Task SaveAsync()
      {
         try
         {
            if (this.ActiveContent is IAnchorView anchorView)
               await anchorView.ViewModel.SaveAsync();

            if (this.ActiveContent is IDocumentView documentView)
            {
               await documentView.ViewModel.SaveAsync();
               await this.OutputErrorsAsync(documentView.ViewModel);
            }

            this.eventAggregator.GetEvent<SaveSolution>().Publish(this.SolutionService.Solution);
         } catch (Exception ex)
         {
            this.dialogService.ShowException(this ,ex);
         }
      }

      private async Task SaveAllAsync()
      {
         try
         {
            // Save settings
            await this.SolutionService.SaveAsync();

            // Save documents
            foreach (var item in this.Documents)
            {
               await item.ViewModel.SaveAsync();
            }

            // Save Anchorables
            foreach (var item in this.Anchorables)
            {
               await item.ViewModel.SaveAsync();
            }

            // save layout
            this.eventAggregator.GetEvent<SaveLayout>().Publish(this.SolutionService.Solution);

            // reload documents
            foreach (var item in this.Documents)
            {
               await item.ViewModel.LoadAsync();
            }

            this.eventAggregator.GetEvent<SaveSolution>().Publish(this.SolutionService.Solution);
            var solution = FileHelper.MakeJson(this.SolutionService.Solution);

            await FileHelper.WriteFileAsync(this.SolutionService.Solution.SolutionFile ,solution);
            this.RefreshMenu(this.SolutionService.Solution);
         } catch (Exception ex)
         {
            this.dialogService.ShowException(this ,ex);
         }
      }

      private void AddRawEntity()
      {
         var viewModel = new DlgRawModelEntryAddViewModel(this.dialogService ,this.SolutionService);
         if (this.dialogService.ShowDialog(this ,viewModel) ?? false)
         {
            RefreshSolution();
         }
      }
      private void RefreshSource()
      {
         var viewModel = new DlgRefreshSourceViewModel(this.dialogService ,this.SolutionService.Solution);
         if (this.dialogService.ShowDialog(this ,viewModel) ?? false)
         {
            RefreshSolution();
         }
      }

      private void AddCoreEntity()
      {
         var viewModel = new DlgCoreEntityAddViewModel(this.dialogService ,this.SolutionService);
         if (this.dialogService.ShowDialog(this ,viewModel) ?? false)
         {
            RefreshSolution();
         }
      }


      private void AddCuratedEntity()
      {
         var viewModel = new DlgCuratedEntityEditViewModel(this.dialogService ,this.SolutionService);
         if (this.dialogService.ShowDialog(this ,viewModel) ?? false)
         {
            // refresh
            this.eventAggregator.GetEvent<RefreshSolution>().Publish(this.SolutionService.Solution);
         }
      }

      private async Task AddDiagramFileAsync(string path)
      {
         var input = await (App.Current.MainWindow as MetroWindow).ShowInputAsync(
             "Create new diagram" ,
             "Diagram file name" ,
             new MetroDialogSettings()
             {
                AffirmativeButtonText = "Create New Diagram" ,
                NegativeButtonText = "Cancel"
             });


         if (!string.IsNullOrEmpty(input))
         {
            // create file
            Diagram diagram = new Diagram();
            diagram.DiagramType = "er";
            string diagramJson = JsonConvert.SerializeObject(diagram ,Formatting.Indented);
            await File.WriteAllTextAsync(Path.Combine(path ,input + ".json") ,diagramJson);

            // refresh
            this.eventAggregator.GetEvent<RefreshSolution>().Publish(this.SolutionService.Solution);
         }
      }


      private void MainViewModel_PropertyChanged(object sender ,System.ComponentModel.PropertyChangedEventArgs e)
      {
         switch (e.PropertyName)
         {
            case nameof(this.ActiveContent):
               if (this.ActiveContent is IAnchorView)
               {
                  this.IsDocumentActive = true;
               } else if (this.ActiveContent is IDocumentView)
               {
                  this.IsDocumentActive = true;
                  IDocumentView dv = (IDocumentView)this.ActiveContent;
                  DocumentViewModelBase v = dv.ViewModel;
                  if (v != null)
                  {
                     this.eventAggregator.GetEvent<DocumentSelectedEvent>().Publish(v.FilePath);
                  }
               } else
               {
                  this.IsDocumentActive = false;
               }
               break;
         }
      }
      public void RefreshSolution()
      {
         this.eventAggregator.GetEvent<RefreshSolution>().Publish(this.SolutionService.Solution);
      }
      private void DocumentClosing(DocumentClosingEventArgs e)
      {
      }
      private async Task OpenHelp()
      {
         try
         {
            string help = @"https://github.com/oraylis/automation/blob/main/docs/DataM8.md";
            ProcessExt.OpenWebsite(help);
         } catch (Exception ex)
         {
            this.dialogService.ShowException(this ,ex);
         }
         await Task.Yield();
      }

      private DlgLoadingWindow _loadingScreen = null;
      public void SetWaitScreen(bool lOn)
      {
         if (lOn && _loadingScreen == null)
         {
            _loadingScreen = new DlgLoadingWindow();
            _loadingScreen.Show();
         }

         if (!lOn)
         {
            _loadingScreen?.Close();
            _loadingScreen = null;
         }
         App.AE();
      }
      private async Task OnFileChangedAsync(FileSystemEventArgs e)
      {
         string file = e.FullPath;

         RefreshSolution();
         App.AE();
         if (e.ChangeType == WatcherChangeTypes.Changed)
         {
            if (File.Exists(file))
            {
               FileInfo fileInfo = new FileInfo(file);
               if (Math.Abs(fileInfo.CreationTime.Ticks - fileInfo.LastAccessTime.Ticks) <= 20000)
               {
                  ProjectItem item = this.GetProjectItemForWindow(fileInfo.FullName);
                  if (item != null)
                  {
                     await this.OpenDocument(item ,true);
                     this.GetProjectView?.SelectProjectItem(item ,false);
                  }
               }
            }
         }
         return;
      }
      private ProjectItem? GetProjectItemForWindow(string fullName)
      {
         ProjectItem item = solutionService.AllProjectItems.Where(x => x.FilePath == fullName).FirstOrDefault();
         return (item);
      }
      private void SetProjectTreeForWindow(string fullName)
      {
         ProjectItem item = this.GetProjectItemForWindow(fullName);
         if (item != null)
         {
            this.GetProjectView?.SelectProjectItem(item ,false);
         }
      }
   }
}

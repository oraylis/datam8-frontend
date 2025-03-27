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
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using Dm8Data;
using Dm8Data.Helper;
using Dm8Data.MessageOutput;
using Dm8Data.Properties;
using Dm8Data.Validate;
using Dm8Main.Base;
using Dm8Main.Models;
using MvvmDialogs;
using Prism.Events;

#region Pragma
#pragma warning disable CA2021
#endregion


namespace Dm8Main.Services
{

    public class SolutionService : Prism.Mvvm.BindableBase, ISolutionService, IDisposable
    {
        [Browsable(false)]
        private readonly IDialogService dialogService;

        [Browsable(false)]
        private readonly IEventAggregator eventAggregator;

        [Browsable(false)]
        private FileSystemWatcher rawWatcher;

        [Browsable(false)]
        private FileSystemWatcher stageWatcher;

        [Browsable(false)]
        private FileSystemWatcher coreWatcher;

        [Browsable(false)]
        private FileSystemWatcher curatedWatcher;

        [Browsable(false)]
        private FileSystemWatcher diagramWatcher;

        [Browsable(false)]
        private FileSystemWatcher outputWatcher;

        [Browsable(false)]
        private FileSystemWatcher generateWatcher;

        #region WatcherActive
        [Browsable(false)]
        public bool WatcherEnable
        {
            set
            {
                if (_watcherEnabled != value)
                {
                    _watcherEnabled = value;
                    this.rawWatcher.EnableRaisingEvents = _watcherEnabled;
                    this.stageWatcher.EnableRaisingEvents = _watcherEnabled;
                    this.coreWatcher.EnableRaisingEvents = _watcherEnabled;
                    this.curatedWatcher.EnableRaisingEvents = _watcherEnabled;
                    this.diagramWatcher.EnableRaisingEvents = _watcherEnabled;
                    this.outputWatcher.EnableRaisingEvents = _watcherEnabled;
                    this.generateWatcher.EnableRaisingEvents = _watcherEnabled;
                }
            }
            get => (_watcherEnabled);
        }
        private bool _watcherEnabled = false;
        #endregion

        #region GitActive
        [Browsable(false)]
        public bool GitActive
        {
            get => _gitActive;
            set => this.SetProperty(ref _gitActive, value);
        }
        private bool _gitActive = false;
        #endregion

        [Browsable(false)]
        public IEnumerable<ProjectItem> AllProjectItems => this.IterateAllProjectItems(this.ProjectItems);

        [Browsable(false)]
        public GitHelper GitHelper {  get; set; }

        [Browsable(false)]
        public SolutionHelper SolutionHelper { get; set; }

        #region Property Solution
        [Browsable(false)]
        public Solution Solution
        {
            get => this.solution;
            set => this.SetProperty(ref this.solution, value);
        }

        private Solution solution;
        #endregion

        #region Property GitPath
        [Browsable(false)]
        [Category("Path")]
        [DisplayName("Git Path")]
        public string GitPath
        {
            get => _gitPath;
            set => this.SetProperty(ref _gitPath, value);
        }
        private string _gitPath;
        #endregion

        #region Property MsBuildPath
        [Browsable(false)]
        [Category("Path")]
        [DisplayName("MsBuild Path")]
        public string MsBuildPath
        {
            get => _msBuildPath;
            set => this.SetProperty(ref _msBuildPath, value);
        }

        private string _msBuildPath;
        #endregion

        #region Property PythonPath
        [Browsable(false)]
        [Category("Path")]
        [DisplayName("Python Path")]
        public string PythonPath
        {
            get => _pythonPath;
            set => this.SetProperty(ref _pythonPath, value);
        }

        private string _pythonPath;
        #endregion

        #region Property GenerateStagePath
        [Category("Generator")]
        [DisplayName("Parameter STAGE")]
        public string GeneratorParameterStage
        {
            get => _generateStagePath;
            set => this.SetProperty(ref _generateStagePath, value);
        }
        private string _generateStagePath;
        #endregion

        #region Property GenerateOutputPath
        [Category("Generator")]
        [DisplayName("Parameter OUTPUT")]
        public string GeneratorParameterOutput
        {
            get => _generateOutputPath;
            set => this.SetProperty(ref _generateOutputPath, value);
        }
        private string _generateOutputPath;
        #endregion

        #region Property Theme
        [Category("Layout")]
        [DisplayName("Theme")]
        public ColorTheme Theme
        {
            get => _theme;
            set => this.SetProperty(ref _theme, value);
        }

        private ColorTheme _theme;
        #endregion

        #region Property ProjectItems
        [Browsable(false)]
        public ObservableCollection<ProjectItem> ProjectItems
        {
            get => _projectItems;
            set => this.SetProperty(ref _projectItems, value);
        }

        private ObservableCollection<ProjectItem> _projectItems;
        #endregion

        #region Property OutputItems
        [Browsable(false)]
        public ObservableCollection<OutputItem> OutputItems
        {
            get => _outputItems;
            set => this.SetProperty(ref _outputItems, value);
        }

        private ObservableCollection<OutputItem> _outputItems;
        #endregion

        #region Property OutputTypes
        [Browsable(false)]
        public ObservableCollection<string> OutputTypes
        {
            get => _outputTypes;
            set => this.SetProperty(ref _outputTypes, value);
        }

        private ObservableCollection<string> _outputTypes;

        #endregion

        #region Property OutputTexts
        [Browsable(false)]
        public ObservableDictionary<string, OutputText> OutputTexts
        {
            get => this.outputTexts;
            set => this.SetProperty(ref outputTexts, value);
        }

        private ObservableDictionary<string, OutputText> outputTexts;

        #endregion

        public SolutionService(IEventAggregator eventAggregator, IDialogService dialogService)
        {
            // other services
            this.eventAggregator = eventAggregator;
            this.dialogService = dialogService;

            // set theme
            if (Settings.Default.Theme.StartsWith("Dark"))
                this.Theme = ColorTheme.Dark;
            else
                this.Theme = ColorTheme.Light;

            // global settings
            this.GitPath = Settings.Default.GitPath;
            this.MsBuildPath = Settings.Default.MsBuildPath;
            this.PythonPath = Settings.Default.PythonPath;
            this.GeneratorParameterStage = Settings.Default.GeneratorParameterSTAGE_V2;
            this.GeneratorParameterOutput = Settings.Default.GeneratorParameterOUTPUT_V2;

            // helper
            this.GitHelper = new GitHelper();
            this.GitHelper.ReportGit = (s) =>
                this.eventAggregator.GetEvent<OutputLineEvent>().Publish(new KeyValuePair<string, string>("Git", s));

            // item collections
            this.ProjectItems = new ObservableCollection<ProjectItem>();
            this.OutputItems = new ObservableCollection<OutputItem>();
            this.OutputTexts = new ObservableDictionary<string, OutputText>();

            this.OutputTypes = new ObservableCollection<string>();
            this.OutputTypes.Add(Properties.Resources.OutputViewModel_Model_Validation);
            if (this.GitActive)
            {
                this.OutputTypes.Add(Properties.Resources.OutputViewModel_Git);
            }

            this.OutputTypes.Add(Properties.Resources.OutputViewModel_Generate);
            this.OutputTypes.Add(Properties.Resources.OutputViewModel_Mermaid);
            foreach (var s in this.OutputTypes)
            {
                this.OutputTexts.Add(s, new OutputText());
            }

            // register for solution events
            this.eventAggregator.GetEvent<OpenSolution>().Subscribe((i) => Application.Current.Dispatcher.InvokeAsync(() => this.OpenSolution(i)));
            this.eventAggregator.GetEvent<RefreshSolution>().Subscribe((i) => Application.Current.Dispatcher.InvokeAsync(() => this.RefreshSolution(i)));
            this.eventAggregator.GetEvent<SaveSolution>().Subscribe((i) => Application.Current.Dispatcher.InvokeAsync(() => this.SaveSolution(i)));
            this.eventAggregator.GetEvent<GitChangeEvent>().Subscribe((g) => Application.Current.Dispatcher.InvokeAsync(() => this.UpdateGitStatus(g)));
        }


        public void Dispose()
        {
            if (this.rawWatcher != null)
            {
                this.rawWatcher.Dispose();
            }
            this.rawWatcher = null;

            if (this.stageWatcher != null)
            {
                this.stageWatcher.Dispose();
            }
            this.stageWatcher = null;

            if (this.coreWatcher != null)
            {
                this.coreWatcher.Dispose();
            }
            this.coreWatcher = null;

            if (this.curatedWatcher != null)
            {
                this.curatedWatcher.Dispose();
            }
            this.curatedWatcher = null;

            if (this.diagramWatcher != null)
            {
                this.diagramWatcher.Dispose();
            }
            this.diagramWatcher = null;

            if (this.generateWatcher != null)
            {
                this.generateWatcher.Dispose();
            }
            this.generateWatcher = null;

            if (this.outputWatcher != null)
            {
                this.outputWatcher.Dispose();
            }
            this.outputWatcher = null;
        }

        public async Task SaveAsync()
        {
            Settings.Default.Theme = this.Theme.ToString();
            Settings.Default.GitPath = this.GitPath;
            Settings.Default.MsBuildPath = this.MsBuildPath;
            Settings.Default.PythonPath = this.PythonPath;
            Settings.Default.GeneratorParameterSTAGE_V2 = this.GeneratorParameterStage;
            Settings.Default.GeneratorParameterOUTPUT_V2 = this.GeneratorParameterOutput;
            Settings.Default.Save();
            await Task.Yield();
        }

        private void OpenSolution(Solution solution)
        {
            App.Wait(true);
            App.MainWindowViewModel.SetWaitScreen(true);
            // set solution
            this.Solution = solution;
            this.SolutionHelper = new SolutionHelper(this.solution, new SendOutputEvents(this.eventAggregator));

            this.eventAggregator.GetEvent<OutputItemEvent>().Subscribe((i) => Application.Current.Dispatcher.InvokeAsync(() => this.OutputEvent(i)));
            this.eventAggregator.GetEvent<OutputItemClearEvent>().Subscribe((i) => Application.Current.Dispatcher.InvokeAsync(() => this.OutputClearEvent(i)));
            this.eventAggregator.GetEvent<OutputLineEvent>().Subscribe((i) => Application.Current.Dispatcher.InvokeAsync(() => this.OutputEvent(i)));
            this.eventAggregator.GetEvent<OutputLineEventEx>().Subscribe((i) => Application.Current.Dispatcher.Invoke(() => this.OutputEventEx(i)));

            // load files in background
            Task.Run(() => this.SolutionHelper.LoadAsync().Wait());

            // create base items
            var baseItem = ProjectItem.CreateItem(ProjectItem.Types.BaseFolder, this, this.eventAggregator);
            var dataTypesItem = ProjectItem.CreateItem(ProjectItem.Types.DataTypes, this, this.eventAggregator);
            var attributesItem = ProjectItem.CreateItem(ProjectItem.Types.AttributeTypes, this, this.eventAggregator);
            var dataProductsItem = ProjectItem.CreateItem(ProjectItem.Types.DataProducts, this, this.eventAggregator);
            var dataSourcesItem = ProjectItem.CreateItem(ProjectItem.Types.DataSources, this, this.eventAggregator);
            baseItem.Children.Add(dataTypesItem);
            baseItem.Children.Add(attributesItem);
            baseItem.Children.Add(dataSourcesItem);
            baseItem.Children.Add(dataProductsItem);

            var rawItem = ProjectItem.CreateItem(ProjectItem.Types.RawFolder, this, this.eventAggregator);

            var stagingItem = ProjectItem.CreateItem(ProjectItem.Types.StagingFolder, this, this.eventAggregator);

            var coreItem = ProjectItem.CreateItem(ProjectItem.Types.CoreFolder, this, this.eventAggregator);

            var curatedItem = ProjectItem.CreateItem(ProjectItem.Types.CuratedFolder, this, this.eventAggregator);

            var diagramItem = ProjectItem.CreateItem(ProjectItem.Types.DiagramFolder, this, this.eventAggregator);

            var generateItem = ProjectItem.CreateItem(ProjectItem.Types.GenerateFolder, this, this.eventAggregator);

            var outputItem = ProjectItem.CreateItem(ProjectItem.Types.OutputFolder, this, this.eventAggregator);

            // initialize item list
            this.ProjectItems.Clear();

            // create root item
            ProjectItem solutionItem = ProjectItem.CreateItem(ProjectItem.Types.Solution, this, this.eventAggregator, relPath: Path.GetFileName(solution.SolutionFile));
            solutionItem.NameEdit = solutionItem.Name;
            solutionItem.IsExpanded = true;
            this.ProjectItems.Add(solutionItem);

            solutionItem.Children.Add(baseItem);
            solutionItem.Children.Add(rawItem);
            solutionItem.Children.Add(stagingItem);
            solutionItem.Children.Add(coreItem);
            solutionItem.Children.Add(curatedItem);
            solutionItem.Children.Add(diagramItem);
            solutionItem.Children.Add(generateItem);
            solutionItem.Children.Add(outputItem);

            // set project items
            this.OutputItems.Clear();

            // scan folder
            this.RefreshSolution(solution);

            // create watcher
            this.rawWatcher = new FileSystemWatcher();
            this.stageWatcher = new FileSystemWatcher();
            this.coreWatcher = new FileSystemWatcher();
            this.curatedWatcher = new FileSystemWatcher();
            this.diagramWatcher = new FileSystemWatcher();
            this.outputWatcher = new FileSystemWatcher();
            this.generateWatcher = new FileSystemWatcher();

            this.WatcherEnable = false;

            // register watcher
            this.RegisterWatcher(this.rawWatcher, this.solution.RawFolderPath, (s) => this.eventAggregator.GetEvent<FileChangeEvent>().Publish(s));
            this.RegisterWatcher(this.stageWatcher, this.solution.StagingFolderPath, (s) => this.eventAggregator.GetEvent<FileChangeEvent>().Publish(s));
            this.RegisterWatcher(this.coreWatcher, this.solution.CoreFolderPath, (s) => this.eventAggregator.GetEvent<FileChangeEvent>().Publish(s));
            this.RegisterWatcher(this.curatedWatcher, this.solution.CuratedFolderPath, (s) => this.eventAggregator.GetEvent<FileChangeEvent>().Publish(s));
            this.RegisterWatcher(this.diagramWatcher, this.solution.DiagramFolderPath, (s) => this.eventAggregator.GetEvent<FileChangeEvent>().Publish(s));
            this.RegisterWatcher(this.outputWatcher, this.solution.StagingFolderPath, (s) => this.eventAggregator.GetEvent<FileChangeEvent>().Publish(s));
            this.RegisterWatcher(this.outputWatcher, this.solution.CoreFolderPath, (s) => this.eventAggregator.GetEvent<FileChangeEvent>().Publish(s));
            this.RegisterWatcher(this.generateWatcher, this.solution.GenerateFolderPath, (s) => this.eventAggregator.GetEvent<FileChangeEvent>().Publish(s));
            this.RegisterWatcher(this.outputWatcher, this.solution.OutputFolderPath, (s) => this.eventAggregator.GetEvent<FileChangeEvent>().Publish(s));

            this.WatcherEnable = true;

            // open last layout
            this.eventAggregator.GetEvent<OpenLayout>().Publish(this.Solution);
            App.Wait(false);
        }


        public void RefreshSolution(Solution solution)
        {
            // set default values
            if (string.IsNullOrEmpty(solution.BasePath))
                solution.BasePath = Resources.Solution_BaseFilePath;

            if (string.IsNullOrEmpty(solution.StagingPath))
                solution.StagingPath = Resources.Solution_StagingFolderPath;

            if (string.IsNullOrEmpty(solution.RawPath))
                solution.RawPath = Resources.Solution_RawFolderPath;

            if (string.IsNullOrEmpty(solution.CorePath))
                solution.CorePath = Resources.Solution_CoreFolderPath;

            if (string.IsNullOrEmpty(solution.GeneratePath))
                solution.GeneratePath = Resources.Solution_GenerateFolderPath;

            if (string.IsNullOrEmpty(solution.OutputPath))
                solution.OutputPath = Resources.Solution_OutputFolderPath;

            var solutionItem = this.ProjectItems[0];
            var solutionItems = this.ProjectItems[0].Children;

            // Refresh Raw
            ProjectItem rawItem = ProjectItem.CreateItem(ProjectItem.Types.RawFolder, this, this.eventAggregator);
            this.ScanFolder(rawItem, this.solution.RawFolderPath, (f) => ProjectItem.Types.RawEntity ,folderType: ProjectItem.Types.RawSubFolder);

            var thisRawItem = solutionItems.FirstOrDefault(i => i.Name == rawItem.Name);
            if (thisRawItem != null)
                thisRawItem.UpdateFrom(rawItem);
            else
                solutionItems.Add(rawItem);

            // refresh Staging
            ProjectItem stagingItem = ProjectItem.CreateItem(ProjectItem.Types.StagingFolder, this, this.eventAggregator);
            this.ScanFolder(stagingItem, this.solution.StagingFolderPath, (f) => ProjectItem.Types.StagingEntity, "*.json");

            var thisStagingItem = solutionItems.FirstOrDefault(i => i.Name == stagingItem.Name);
            if (thisStagingItem != null)
                thisStagingItem.UpdateFrom(stagingItem);
            else
                solutionItem.Children.Add(stagingItem);

            // refresh Core
            ProjectItem coreItem = ProjectItem.CreateItem(ProjectItem.Types.CoreFolder, this, this.eventAggregator);
            this.ScanFolder(coreItem, this.solution.CoreFolderPath, (f) => ProjectItem.Types.CoreEntity, "*.json");

            var thisCoreItem = solutionItems.FirstOrDefault(i => i.Name == coreItem.Name);
            if (thisCoreItem != null)
                thisCoreItem.UpdateFrom(coreItem);
            else
                solutionItem.Children.Add(coreItem);

            // refresh Curated
            ProjectItem curatedItem = ProjectItem.CreateItem(ProjectItem.Types.CuratedFolder, this, this.eventAggregator);
            this.ScanFolder(curatedItem, this.solution.CuratedFolderPath, (f) => ProjectItem.Types.CuratedEntity, "*.json");

            var thisCuratedItem = solutionItems.FirstOrDefault(i => i.Name == curatedItem.Name);
            if (thisCuratedItem != null)
                thisCuratedItem.UpdateFrom(curatedItem);
            else
                solutionItem.Children.Add(curatedItem);

            // refresh diagram
            ProjectItem diagramItem = ProjectItem.CreateItem(ProjectItem.Types.DiagramFolder, this, this.eventAggregator);
            this.ScanFolder(diagramItem, this.solution.DiagramFolderPath, (f) => ProjectItem.Types.DiagramFile, "*.json");

            var thisDiagramItem = solutionItems.FirstOrDefault(i => i.Name == diagramItem.Name);
            if (thisDiagramItem != null)
                thisDiagramItem.UpdateFrom(diagramItem);
            else
                solutionItem.Children.Add(diagramItem);

            // Refresh Generate
            ProjectItem generateItem = ProjectItem.CreateItem(ProjectItem.Types.GenerateFolder, this, this.eventAggregator);
            this.ScanFolder(generateItem, this.solution.GenerateFolderPath, (f) => ProjectItem.Types.GenerateJinja2, "*.jinja2", "", ProjectItem.Types.GenerateSubFolder);
            this.ScanFolder(generateItem, this.solution.GenerateFolderPath, (f) => ProjectItem.Types.GenerateJinja2, "*.jinja2.include", "", ProjectItem.Types.GenerateSubFolder);
            this.ScanFolder(generateItem, this.solution.GenerateFolderPath, (f) => ProjectItem.Types.GenerateFilePython, "*.py", "", ProjectItem.Types.GenerateSubFolder);

            var thisGenerateItem = solutionItems.FirstOrDefault(i => i.Name == generateItem.Name);
            if (thisGenerateItem != null)
                thisGenerateItem.UpdateFrom(generateItem);
            else
                solutionItem.Children.Add(generateItem);


            // Refresh output
            ProjectItem outputItem = ProjectItem.CreateItem(ProjectItem.Types.OutputFolder, this, this.eventAggregator);
            this.ScanFolder(outputItem, this.solution.OutputFolderPath, (f) => ProjectItem.Types.CodeFile);

            var thisOutputItem = solutionItems.FirstOrDefault(i => i.Name == outputItem.Name);
            if (thisOutputItem != null)
                thisOutputItem.UpdateFrom(outputItem);
            else
                solutionItem.Children.Add(outputItem);
        }

        private async void SaveSolution(Solution solution)
        {
            this.RefreshSolution(solution);

            var solutionJson = FileHelper.MakeJson(solution);


            await FileHelper.WriteFileAsync(solution.SolutionFile, solutionJson);

            // open last layout
            this.eventAggregator.GetEvent<SaveLayout>().Publish(this.Solution);
        }


        private void RegisterWatcher(FileSystemWatcher watcher, string path, Action<string> fileChange)
        {
            watcher.Path = path;
            watcher.IncludeSubdirectories = true;
            watcher.NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.CreationTime | NotifyFilters.Size | NotifyFilters.DirectoryName;
            watcher.Filter = "*.*";

            // Add event handlers.
            watcher.Changed += (o, e) => this.Watcher_Created(o, e, fileChange);
            watcher.Created += (o, e) => this.Watcher_Created(o, e, fileChange);
            watcher.Deleted += (o, e) => this.Watcher_Created(o, e, fileChange);
        }

        private void Watcher_Created(object sender, FileSystemEventArgs e, Action<string> fileChange)
        {
            try
            {
                fileChange(e.FullPath);
            }
            catch (Exception ex)
            {
                this.dialogService.ShowException(this, ex);
            }
        }

        private void OutputEvent(OutputItem outputItem)
        {
            lock (this.OutputItems)
            {
                if (!string.IsNullOrEmpty(outputItem.Code))
                {
                    this.OutputItems.Add(outputItem);
                }
                else if (this.OutputItems.Count == 0)
                {
                    this.OutputItems.Add(outputItem);
                }
            }
        }

        private void OutputEvent(KeyValuePair<string, string> v)
        {
            try
            {
                if (v.Value == null)
                {
                    this.OutputTexts[v.Key] = new OutputText();
                }
                else
                {
                    var ot = this.OutputTexts[(v.Key)];
                    ot.Content.AppendLine(v.Value);
                    this.OutputTexts[(v.Key)] = ot;
                }
            }
            catch
            {
            }
        }
        private void OutputEventEx(KeyValuePair<string, StringBuilder> v)
        {
            try
            {
                if (v.Value == null)
                {
                    this.OutputTexts[v.Key] = new OutputText();
                }
                else
                {
                    var ot = this.OutputTexts[(v.Key)];
                    ot.Content.Append(v.Value);
                    this.OutputTexts[(v.Key)] = ot;
                }
            }
            catch
            {
                // ignored
            }
        }

        private void OutputClearEvent(string file)
        {
            lock (this.OutputItems)
            {
                if (string.IsNullOrEmpty(file) || file == "*")
                {
                    this.OutputItems.Clear();
                }
                else
                {
                    var outputItemsToRemove = this.OutputItems.Where(i => i.FilePath == file).ToList();
                    foreach (var outputItemToRemove in outputItemsToRemove)
                    {
                        this.OutputItems.Remove(outputItemToRemove);
                    }
                }
            }
        }

        private IEnumerable<ProjectItem> IterateAllProjectItems(IEnumerable<ProjectItem> projectItems)
        {
            foreach (var item in projectItems)
            {
                yield return item;
                foreach (var subItem in this.IterateAllProjectItems(item.Children.OfType<ProjectItem>()))
                {
                    yield return subItem;
                }
            }
        }

        private void ScanFolder(ProjectItem item, string startFolder, Func<string, ProjectItem.Types> typeFunc, string pattern = "*", string partPath = "", ProjectItem.Types folderType = ProjectItem.Types.Folder)
        {
            try
            {
                var path = Path.Combine(startFolder, partPath);
                if (!Directory.Exists(path))
                {
                    Directory.CreateDirectory(path);
                }

                foreach (var f in Directory.EnumerateDirectories(path).OrderBy(p => p))
                {
                    var p = f.Substring(f.LastIndexOf(Path.DirectorySeparatorChar) + 1);
                    //var folder = ProjectItem.CreateItem(folderType, this, this.eventAggregator, Path.Combine(item.Name, partPath, p));
                    var folder = ProjectItem.CreateItem(folderType, this, this.eventAggregator, Path.Combine(partPath, p) );
                    var existingFolder = item.Children.FirstOrDefault(d => d.Name == folder.Name);
                    // does not exist yet
                    if (existingFolder != null)
                    {
                        folder = existingFolder.GetThis();
                    }
                    else
                    {
                        item.Children.Add(folder);
                    }

                    this.ScanFolder(folder, startFolder, typeFunc, pattern, Path.Combine(partPath, p), folderType);
                }
                foreach (var f in Directory.EnumerateFiles(path, pattern).OrderBy(p => p))
                {
                    var p = f.Substring(f.LastIndexOf(Path.DirectorySeparatorChar) + 1);
                    var file = ProjectItem.CreateItem(typeFunc(p), this, this.eventAggregator, Path.Combine(partPath, p));
                    item.Children.Add(file);
                }
            }
            catch (Exception ex)
            {
                this.dialogService.ShowException(this, ex);
            }
        }


        private void UpdateGitStatus(GitHelper gitHelper)
        {
            foreach (var item in this.ProjectItems.SelectMany(p => p.GetItems()))
            {
                item.GetThis().GitStatus = this.GitHelper.GetFileStatus(item.GetThis().FilePath);
            }

            foreach (var item in this.ProjectItems)
            {
                this.SetGitStatus(item);
            }
        }

        private void SetGitStatus(ProjectItem parent)
        {
            // keep status of files
            if (!parent.IsFolder)
                return;


            GitHelper.GitStatus rc = GitHelper.GitStatus.NoGit;
            foreach (var item in parent.Children.OfType<ProjectItem>())
            {
                if (item.IsFolder)
                    this.SetGitStatus(item);

                // combine status of children
                switch (item.GitStatus)
                {
                    case GitHelper.GitStatus.Modified:
                        rc = GitHelper.GitStatus.Modified;
                        break;

                    case GitHelper.GitStatus.Added:
                        if (rc != GitHelper.GitStatus.Modified)
                            rc = GitHelper.GitStatus.Added;
                        break;

                    case GitHelper.GitStatus.Deleted:
                        if (rc != GitHelper.GitStatus.Added && rc != GitHelper.GitStatus.Modified)
                            rc = GitHelper.GitStatus.Deleted;
                        break;

                    case GitHelper.GitStatus.Unchanged:
                        if (rc != GitHelper.GitStatus.Added && rc != GitHelper.GitStatus.Modified && rc != GitHelper.GitStatus.Deleted)
                            rc = GitHelper.GitStatus.Unchanged;
                        break;

                    case GitHelper.GitStatus.NoGit:
                        break;
                }
            }
            parent.GitStatus = rc;
        }

    }
}

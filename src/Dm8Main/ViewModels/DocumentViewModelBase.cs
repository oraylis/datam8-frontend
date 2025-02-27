using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Composition;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;
using Dm8Data.Validate.Exceptions;
using Dm8Main.Models;
using Dm8Main.Services;
using ICSharpCode.AvalonEdit.Highlighting;
using MvvmDialogs;
using Prism.Commands;
using Prism.Events;

namespace Dm8Main.ViewModels
{
    public enum DocumentOperation
    {
        LoadDocument,
        SaveDocument
    }

    [Export]
    public abstract class DocumentViewModelBase : ViewModelBase, IDisposable
    {
        protected readonly Queue<DocumentOperation> documentOperations = new Queue<DocumentOperation>();
        
        protected ISolutionService solutionService;

        protected IEventAggregator eventAggregator;

        protected IDialogService dialogService;

        protected bool runningOperations = false;

        public event Action Closed;

        #region Property ProjectItem
        public ProjectItem ProjectItem
        {
            get => this.projectItem;
            set => this.SetProperty(ref this.projectItem, value);
        }

        private ProjectItem projectItem;
        #endregion

        #region Property CloseCommand
        public DelegateCommand CloseCommand
        {
            get => this.closeCommand;
            set => this.SetProperty(ref this.closeCommand, value);
        }

        private DelegateCommand closeCommand;

        #endregion

        #region Property FilePath
        public string FilePath
        {
            get => this.filePath;
            set => this.SetProperty(ref this.filePath, value);
        }

        private string filePath;
        #endregion

        #region Property ToolTip
        public string ToolTip
        {
            get => this.toolTip;
            set => this.SetProperty(ref this.toolTip, value);
        }

        private string toolTip;
        #endregion

        #region Property JsonCode
        public string JsonCode
        {
            get => this.jsonCode;
            set => this.SetProperty(ref this.jsonCode, value);
        }

        private string jsonCode;
        #endregion

        #region Property ErrorList
        public ObservableCollection<ModelReaderException> ErrorList
        {
            get => this.errorList;
            set => this.SetProperty(ref this.errorList, value);
        }

        private ObservableCollection<ModelReaderException> errorList;
        #endregion

        #region Property SyntaxHighlighting
        public IHighlightingDefinition SyntaxHighlighting
        {
            get => this.syntaxHighlighting;
            set => this.SetProperty(ref this.syntaxHighlighting, value);
        }

        private IHighlightingDefinition syntaxHighlighting;
        #endregion

        #region Property SyntaxHighlightingSql
        public IHighlightingDefinition SyntaxHighlightingSql
        {
            get => this.syntaxHighlightingSql;
            set => this.SetProperty(ref this.syntaxHighlightingSql, value);
        }

        private IHighlightingDefinition syntaxHighlightingSql;
        #endregion

        #region Property IsJsonLoaded
        public bool IsJsonLoaded
        {
            get => this.isJsonLoaded;
            set => this.SetProperty(ref this.isJsonLoaded, value);
        }

        private bool isJsonLoaded;
        #endregion

        #region Property IsLoading
        public bool IsLoading
        {
            get => this.isLoading;
            set => this.SetProperty(ref this.isLoading, value);
        }

        private bool isLoading;
        #endregion

        #region Property IsSaving
        public bool IsSaving
        {
            get => this.isSaving;
            set => this.SetProperty(ref this.isSaving, value);
        }

        private bool isSaving;
        #endregion

        #region Property LastWriteTimeUtc
        public DateTime LastWriteTimeUtc
        {
            get => this.lastWriteTimeUtc;
            set => this.SetProperty(ref this.lastWriteTimeUtc, value);
        }

        private DateTime lastWriteTimeUtc;
        #endregion

        public DocumentViewModelBase(ISolutionService solutionService, IEventAggregator eventAggregator, IDialogService dialogService)
        {
            this.eventAggregator = eventAggregator;
            this.solutionService = solutionService;
            this.dialogService = dialogService;
            this.solutionService.PropertyChanged += this.SolutionServicePropertyChanged;
            this.PropertyChanged += this.DocumentViewModelBase_PropertyChanged;
            this.CloseCommand = new DelegateCommand(async () => await this.CloseAsync());
            this.SetSyntaxHighlighting();
            this.eventAggregator.GetEvent<FileChangeEvent>().Subscribe(this.OnFileChanged);
            this.lastWriteTimeUtc = DateTime.MinValue;
            this.IsJsonLoaded = false;
            this.IsLoading = false;
            this.IsSaving = false;
        }

        public MessageBoxResult ShowMessageBox(
            string messageBoxText,
            string caption = "",
            MessageBoxButton button = MessageBoxButton.OK,
            MessageBoxImage icon = MessageBoxImage.None,
            MessageBoxResult defaultResult = MessageBoxResult.None)
        {
            try
            {
                return this.dialogService.ShowMessageBox(this,
                    messageBoxText,
                    caption,
                    button,
                    icon,
                    defaultResult);

            }
            catch (ViewNotRegisteredException)
            {
                return this.dialogService.ShowMessageBox(Application.Current.MainWindow.DataContext as INotifyPropertyChanged,
                    messageBoxText,
                    caption,
                    button,
                    icon,
                    defaultResult);
            }
}

        private void OnFileChanged(string file)
        {
            // message for this window
            if (this.FilePath != file)
                return;

            if (this.IsSaving)
                return;

            // this was "my" change - no write from outside
            if (new FileInfo(file).LastWriteTimeUtc < this.LastWriteTimeUtc)
                return;

            if (!this.IsModified)
            {
                Task loadTask = this.LoadAsync();
            }
            else 
            {
                App.Current.Dispatcher.Invoke(() =>
                {
                    MessageBoxResult reload = this.ShowMessageBox(
                            string.Format("The file {0} was modified. Do you want to reload the file (changes will get lost)?", this.FilePath), "File modified",
                            MessageBoxButton.YesNo);

                    if (reload == MessageBoxResult.Yes)
                    {
                        Task loadTask = this.LoadAsync();
                    }
                });
            }
        }

        public override void Dispose()
        {
            base.Dispose();
        }


        private void SolutionServicePropertyChanged(object sender, System.ComponentModel.PropertyChangedEventArgs e)
        {
            switch (e.PropertyName)
            {
                case nameof(SolutionService.Theme):
                    this.SetSyntaxHighlighting();
                    break;
            }
        }

        private void DocumentViewModelBase_PropertyChanged(object sender, System.ComponentModel.PropertyChangedEventArgs e)
        {
            switch (e.PropertyName)
            {                
                case nameof(this.ProjectItem):
                    this.ContentId = "Item$" + this.ProjectItem.Type + (this.ProjectItem == null ? "" : "#" + this.ProjectItem.RelativeFilePath);
                    break;
            }
        }

        public virtual void SetSyntaxHighlighting()
        {
            string resource = this.solutionService.Theme == Base.ColorTheme.Dark ? "Dm8Main.Resources.JsonDark.xshd" : "Dm8Main.Resources.JsonLight.xshd";
            using (var stream = System.Reflection.Assembly.GetExecutingAssembly().GetManifestResourceStream(resource))
            {
                if (stream != null)
                {
                    using (var reader = new System.Xml.XmlTextReader(stream))
                    {
                        this.SyntaxHighlighting =
                            ICSharpCode.AvalonEdit.Highlighting.Xshd.HighlightingLoader.Load(reader,
                                HighlightingManager.Instance);
                    }
                }
            }

            resource = this.solutionService.Theme == Base.ColorTheme.Dark ? "Dm8Main.Resources.TSQLDark.xshd" : "Dm8Main.Resources.TSQLLight.xshd";
            using (var stream = System.Reflection.Assembly.GetExecutingAssembly().GetManifestResourceStream(resource))
            {
                using (var reader = new System.Xml.XmlTextReader(stream))
                {
                    this.SyntaxHighlightingSql =
                        ICSharpCode.AvalonEdit.Highlighting.Xshd.HighlightingLoader.Load(reader,
                            ICSharpCode.AvalonEdit.Highlighting.HighlightingManager.Instance);
                }
            }
        }

        public async Task LoadAsync()
        {
            lock (this.documentOperations)
            {
                this.documentOperations.Enqueue(DocumentOperation.LoadDocument);
            }

            await this.RunOperations();
        }


        public async Task SaveAsync()
        {
            lock (this.documentOperations)
            {
                this.documentOperations.Enqueue(DocumentOperation.SaveDocument);
            }

            await this.RunOperations();
        }

        public virtual Task SaveAllAsync(IList<ProjectItem> rc)
        {
            throw new NotImplementedException();
        }

        public virtual Task ValidateAsync()
        {
            throw new NotImplementedException();
        }


        protected virtual async Task CloseAsync()
        {
            await Task.Yield();
            this.Closed?.Invoke();
            this.Dispose();
        }

        private async Task RunOperations()
        {
            lock (this)
            {
                if (!this.runningOperations)
                {
                    // this task is running the operation
                    this.runningOperations = true;
                }
                else
                {
                    return;
                }
            }

            // waiting for other operations to complete
            try
            {
                // running operations
                while (true)
                {
                    DocumentOperation operation;
                    lock (this.documentOperations)
                    {
                        if (!this.documentOperations.Any())
                            break;
                    }

                    operation = this.documentOperations.Dequeue();
                    switch (operation)
                    {
                        case DocumentOperation.LoadDocument:
                            bool restoreIsLoading = this.IsLoading;
                            try
                            {
                                this.IsLoading = true;
                                await this.LoadInternalAsync();
                            }
                            finally
                            {
                                this.IsLoading = restoreIsLoading;
                            }
                            break;

                        case DocumentOperation.SaveDocument:
                            bool restoreIsSaving = this.IsSaving;
                            try
                            {
                                this.IsSaving = true;
                                await this.SaveInternalAsync();
                            }
                            finally
                            {
                                this.IsSaving = restoreIsSaving;
                            }
                            break;
                    }
                }
            }
            finally
            {
                lock (this)
                {
                    this.runningOperations = false;
                }
            }

        }

        /// <summary>
        /// Reloads the file 
        /// </summary>
        /// <exception cref="NotImplementedException"></exception>
        protected virtual Task LoadInternalAsync()
        {
            throw new NotImplementedException();
        }


        protected virtual Task SaveInternalAsync()
        {
            throw new NotImplementedException();
        }



    }
}
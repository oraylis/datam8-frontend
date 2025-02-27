using System;
using System.Collections.Generic;
using System.Composition;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Dm8Data.Helper;
using Dm8Data;
using Dm8Data.Validate.Exceptions;
using Dm8Main.Base;
using Dm8Main.Models;
using Dm8Main.Services;
using MvvmDialogs;
using Prism.Commands;
using Prism.Events;
using Unity;

namespace Dm8Main.ViewModels
{
    [Export]
    public class CodeFileViewModel : DocumentViewModelBase
    {
        private readonly IUnityContainer unityContainer;

        private readonly Solution solution;

        public CodeFileViewModel(IUnityContainer container, ISolutionService solutionService, IEventAggregator eventAggregator, IUnityContainer unityContainer, IDialogService dialogService)
            : base(solutionService, eventAggregator, dialogService)
        {
            this.unityContainer = unityContainer;
            this.dialogService = dialogService;
            this.solutionService = solutionService;

            // solution must be opened
            this.solution = solutionService.Solution;
            if (this.solution == null)
                throw new ArgumentNullException(nameof(this.solution));
        }

        public override void SetSyntaxHighlighting()
        {
            string resource = null;
            if (this.FilePath == null)
                return;

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
                return;

            using (var stream = System.Reflection.Assembly.GetExecutingAssembly().GetManifestResourceStream(resource))
            {
                using (var reader = new System.Xml.XmlTextReader(stream))
                {
                    this.SyntaxHighlighting =
                        ICSharpCode.AvalonEdit.Highlighting.Xshd.HighlightingLoader.Load(reader,
                        ICSharpCode.AvalonEdit.Highlighting.HighlightingManager.Instance);
                }
            }
        }


        private async void Watcher_Created(object sender, FileSystemEventArgs e)
        {
            try
            {
                await this.LoadAsync();
            }
            catch (Exception ex)
            {
                this.dialogService.ShowException(this, ex);
            }
        }


        protected override async Task LoadInternalAsync()
        {
            this.FilePath = this.ProjectItem.FilePath;
            this.ToolTip = $"{this.ProjectItem.Type} - {this.ProjectItem.Name} ({this.ProjectItem.RelativeFilePath})";
            this.Title = this.ProjectItem.Name;
            string code = await FileHelper.ReadFileAsync(this.ProjectItem.FilePath);
            this.IsModified = false;
            this.SetSyntaxHighlighting();
            if (this.JsonCode != code)
            {
                this.JsonCode = code;
            }
        }

        protected override async Task SaveInternalAsync()
        {
            await Task.Yield();
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
                this.dialogService.ShowException(this, ex);
            }
        }

        public override async Task ValidateAsync()
        {
            await Task.Yield();
        }
    }
}

using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Composition;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using Dm8Data;
using Dm8Data.Curated;
using Dm8Data.Diagram;
using Dm8Data.Helper;
using Dm8Locator.Dm8l;
using Dm8Main.Base;
using Dm8Main.Models;
using Dm8Main.Services;
using Dm8Main.ViewModels.Dialog;
using MahApps.Metro.IconPacks;
using MvvmDialogs;
using Prism.Commands;
using Prism.Events;
using Unity;

namespace Dm8Main.ViewModels
{
    [Export]
    public class DiagramViewModel : DocumentViewModel<Diagram>
    {
        #region Property EditCommand
        public DelegateCommand EditCommand
        {
            get => this.editCommand;
            set => this.SetProperty(ref this.editCommand, value);
        }

        private DelegateCommand editCommand;
        #endregion

        #region Property VisualizeFunctionCommand
        public DelegateCommand VisualizeFunctionCommand
        {
            get => this.visualizeFunctionCommand;
            set => this.SetProperty(ref this.visualizeFunctionCommand, value);
        }

        private DelegateCommand visualizeFunctionCommand;
        #endregion

        #region Property VisualizeModelCommand
        public DelegateCommand VisualizeModelCommand
        {
            get => this.visualizeModelCommand;
            set => this.SetProperty(ref this.visualizeModelCommand, value);
        }

        private DelegateCommand visualizeModelCommand;
        #endregion

        #region Property MermaidString
        public string MermaidString
        {
            get => this.mermaidString;
            set => this.SetProperty(ref this.mermaidString, value);
        }

        private string mermaidString;
        #endregion

        #region Property VisualSvg
        public string VisualSvg
        {
            get => this.visualSvg;
            set => this.SetProperty(ref this.visualSvg, value);
        }

        private string visualSvg;
        #endregion

        #region Property ScaleFactor
        public double ScaleFactor
        {
            get => this.scaleFactor;
            set => this.SetProperty(ref this.scaleFactor, value);
        }

        private double scaleFactor;
        #endregion


        public DiagramViewModel(IUnityContainer container, ISolutionService solutionService, IEventAggregator eventAggregator, IDialogService dialogService)
        : base(container, solutionService, eventAggregator, dialogService)
        {
            this.EditCommand = new DelegateCommand(this.Edit);
            this.VisualizeModelCommand = new DelegateCommand(async () => await this.VisualizeModelAsync());
            this.VisualizeFunctionCommand = new DelegateCommand(async () => await this.VisualizeFunctionAsync());
            this.ScaleFactor = 1.0;
        }

        private void Edit()
        {
            var viewModel = new DlgCuratedEntityEditViewModel(this.dialogService, this.solutionService);
            viewModel.IsNewMode = false;
            viewModel.SelectedSourceEntities = this.Item.CoreEntities;
            if (this.dialogService.ShowDialog(this, viewModel) ?? false)
            {
                this.Item.CoreEntities.Clear();
                foreach (var entitySelect in viewModel.Entities.Where(e => e.IsSelected))
                {
                    var dm8l = this.solutionService.SolutionHelper.GetDm8lFromFileName(entitySelect.FilePath);
                    this.Item.CoreEntities.Add(dm8l.Value);
                }
            }
        }

        #region Visualize
        private async Task VisualizeModelAsync()
        {
            try
            {
                MermaidHelper mermaidHelper = new MermaidHelper();
                StringBuilder mermaid = new StringBuilder();
                mermaid.Append(mermaidHelper.PrintInit());
                await this.AddEntitiesAsync(mermaid, mermaidHelper, false);
                        
                // print all realtionships (also between)
                mermaid.Append(mermaidHelper.PrintAllRelationship());

                this.MermaidString = mermaid.ToString();
                await this.RenderMermaidAsync();
            }
            catch (Exception ex)
            {
                this.dialogService.ShowException(this, ex);
            }
        }

        private async Task VisualizeFunctionAsync()
        {
            try
            {
                MermaidHelper mermaidHelper = new MermaidHelper(MermaidHelper.GraphType.ClassDiagram);
                StringBuilder mermaid = new StringBuilder();
                mermaid.Append(mermaidHelper.PrintInit());
                await this.AddEntitiesAsync(mermaid, mermaidHelper, true);

                // print all realtionships (also between)
                mermaid.Append(mermaidHelper.PrintAllRelationship());

                this.MermaidString = mermaid.ToString();
                await this.RenderMermaidAsync();

            }
            catch (Exception ex)
            {
                this.dialogService.ShowException(this, ex);
            }
        }

        private async Task AddEntitiesAsync(StringBuilder mermaid, MermaidHelper mermaidHelper, bool includeFunctions)
        {
            foreach (var dm8l in this.Item.CoreEntities)
            {
                var entity = await this.solutionService.SolutionHelper.LoadOrGetCoreEntityAsync(new Dm8lEntity(dm8l));
                mermaid.Append(mermaidHelper.PrintEntity(entity));

                if (!string.IsNullOrEmpty(entity.ExtensionOf))
                {
                    var extEntity = await this.solutionService.SolutionHelper.LoadOrGetCoreEntityAsync(
                        new Dm8lEntity(entity.ExtensionOf));
                    mermaid.Append(mermaidHelper.PrintEntity(extEntity));
                    mermaid.Append(mermaidHelper.PrintIsA(entity));
                }

                // select all relationships
                // todo parameter - include related entities
                foreach (var relationship in entity.Relationship)
                {
                    var relEntity = await this.solutionService.SolutionHelper.LoadOrGetCoreEntityAsync(
                        new Dm8lEntity(relationship.Dm8lKey));
                    mermaid.Append(mermaidHelper.PrintEntity(relEntity));
                }

                // add functions
                if (includeFunctions)
                {
                    foreach (var function in this.solutionService.SolutionHelper.GetFunctions(new Dm8lEntity(dm8l)))
                    {
                        mermaid.Append(mermaidHelper.PrintFunction(entity, function));
                    }
                }
            }           
        }


        private async Task RenderMermaidAsync()
        {
            var exeFileName = "cmd.exe";
            var pathDirs = Environment.GetEnvironmentVariable("PATH").Split(';');
            var exeFileNameFullPath = (string)null;
            foreach (string dir in pathDirs)
            {
                string fullPath = Path.Combine(dir, exeFileName);
                if (File.Exists(fullPath))
                {
                    exeFileNameFullPath = fullPath;
                    break;
                }
            }

            if (exeFileNameFullPath == null)
                return;

            var inFile = Path.GetTempFileName();
            var outFile = Path.GetTempFileName().Replace(".tmp", ".png");
            var args = $"/c mmdc -i {inFile} -o {outFile} -e png -s 3";
            if (this.solutionService.Theme == ColorTheme.Dark)
            {
                args += " -b 252526";
            }
            else
            {
                args += " -b F5F5F5";
            }
            File.WriteAllText(inFile, this.MermaidString);
            await ProcessExt.RunAsync(exeFileNameFullPath, args,
                (s) => this.eventAggregator.GetEvent<OutputLineEvent>().Publish(new KeyValuePair<string, string>("Mermaid", s)),
                (s) => this.eventAggregator.GetEvent<OutputLineEvent>().Publish(new KeyValuePair<string, string>("Mermaid", "Error: " + s))
            );
            try
            {
                var size = PngHelper.GetDimensions(outFile);
                var cropedFile = PngHelper.Crop(outFile, (int)(size.Width * 0.98), (int)(size.Height * 0.98));

                this.VisualSvg = cropedFile;
            }
            catch
            {
            }
        }

        #endregion
    }
}

using System;
using System.Collections.ObjectModel;
using System.Composition;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using Dm8Data.Core;
using Dm8Data.DataProducts;
using Dm8Data.Helper;
using Dm8Data.Validate;
using Dm8Main.Base;
using Dm8Main.Models;
using Dm8Main.Services;
using MvvmDialogs;
using Newtonsoft.Json;
using Prism.Commands;

namespace Dm8Main.ViewModels.Dialog
{

    [Export]
    public class DlgCoreEntityAddViewModel : Prism.Mvvm.BindableBase, IModalDialogViewModel
    {
        private readonly ISolutionService solutionService;

        private readonly IDialogService dialogService;

        public bool? DialogResult { get; set; }

        #region Property LoadedCommand
        public DelegateCommand LoadedCommand
        {
            get => this.loadedCommand;
            set => this.SetProperty(ref this.loadedCommand, value);
        }

        private DelegateCommand loadedCommand;
        #endregion

        #region Property DataProducts
        public ObservableCollection<Dm8Data.DataProducts.DataProduct> DataProducts
        {
            get => this.dataProducts;
            set => this.SetProperty(ref this.dataProducts, value);
        }
        public ObservableCollection<Dm8Data.DataProducts.DataProduct> dataProducts;
        #endregion

        #region Property SelectedDataProduct
        public Dm8Data.DataProducts.DataProduct SelectedDataProduct
        {
            get => this.selectedDataProduct;
            set => this.SetProperty(ref this.selectedDataProduct, value);
        }
        public Dm8Data.DataProducts.DataProduct selectedDataProduct;
        #endregion

        #region Property DataModules
        public ObservableCollection<Dm8Data.DataProducts.DataModule> DataModules
        {
            get => this.dataModules;
            set => this.SetProperty(ref this.dataModules, value);
        }
        private ObservableCollection<Dm8Data.DataProducts.DataModule> dataModules;
        #endregion

        #region Property SelectedDataModule
        public Dm8Data.DataProducts.DataModule SelectedDataModule
        {
            get => this.selectedDataModule;
            set => this.SetProperty(ref this.selectedDataModule, value);
        }
        private Dm8Data.DataProducts.DataModule selectedDataModule;
        #endregion

        #region Property OKCommand
        public DelegateCommand<IClosableWindow> OKCommand
        {
            get => this.okCommand;
            set => this.SetProperty(ref this.okCommand, value);
        }

        private DelegateCommand<IClosableWindow> okCommand;
        #endregion

        #region Property CancelCommand
        public DelegateCommand<IClosableWindow> CancelCommand
        {
            get => this.cancelCommand;
            set => this.SetProperty(ref this.cancelCommand, value);
        }

        private DelegateCommand<IClosableWindow> cancelCommand;
        #endregion

        #region Property IsNextEnabled
        public bool IsNextEnabled
        {
            get => this.isNextEnabled;
            set => this.SetProperty(ref this.isNextEnabled, value);
        }

        private bool isNextEnabled;
        #endregion

        #region Property WizardCanComplete
        public bool WizardCanComplete
        {
            get => this.wizardCanComplete;
            set => this.SetProperty(ref this.wizardCanComplete, value);
        }

        private bool wizardCanComplete;
        #endregion

        #region Property SelectedIndex
        public int SelectedIndex
        {
            get => this.selectedIndex;
            set => this.SetProperty(ref this.selectedIndex, value);
        }

        private int selectedIndex;
        #endregion

        #region Property NumSelectablePages
        public int NumSelectablePages
        {
            get => this.numSelectablePages;
            set => this.SetProperty(ref this.numSelectablePages, value);
        }

        private int numSelectablePages;
        #endregion

        #region Property Entities
        public ObservableCollection<EntitySelect> Entities
        {
            get => this.entities;
            set => this.SetProperty(ref this.entities, value);
        }

        private ObservableCollection<EntitySelect> entities;
        #endregion

        #region Property CoreModel
        public Dm8Data.Core.ModelEntry CoreModel
        {
            get => this.coreModel;
            set => this.SetProperty(ref this.coreModel, value);
        }

        private Dm8Data.Core.ModelEntry coreModel;
        #endregion

        #region Property Name
        public string DisplayName
        {
            get => this.displayName;
            set => this.SetProperty(ref this.displayName, value);
        }

        private string displayName;
        #endregion

        #region Property Name
        public string Name
        {
            get => this.name;
            set => this.SetProperty(ref this.name, value);
        }

        private string name;
        #endregion


        #region Property Path
        public string RelativePath
        {
            get => this.path;
            set => this.SetProperty(ref this.path, value);
        }

        private string path;
        #endregion

        #region Property SelectedEntities
        public ObservableCollection<EntitySelect> SelectedEntities
        {
            get => this.selectedEntities;
            set => this.SetProperty(ref this.selectedEntities, value);
        }

        private ObservableCollection<EntitySelect> selectedEntities;
        #endregion




        public DlgCoreEntityAddViewModel(IDialogService dialogService, ISolutionService solutionService)
        {
            this.solutionService = solutionService;
            this.dialogService = dialogService;

            this.PropertyChanged += this.DataSourceEditViewModel_PropertyChanged;
            this.OKCommand = new DelegateCommand<IClosableWindow>(this.OnOK);
            this.CancelCommand = new DelegateCommand<IClosableWindow>(this.OnCancel);
            this.LoadedCommand = new DelegateCommand(this.OnLoaded);
            this.IsNextEnabled = false;
            this.SelectedIndex = 0;
            this.NumSelectablePages = 1;
        }

        private async void OnLoaded()
        {
            try
            {
                DataProductModelReader dataProductModelReader = new DataProductModelReader();
                var dataProducts = await dataProductModelReader.ReadFromFileAsync(this.solutionService.Solution.DataProductsFilePath);
                this.DataProducts = new ObservableCollection<Dm8Data.DataProducts.DataProduct>(dataProducts);

                this.Entities = new ObservableCollection<EntitySelect>(
                    this.solutionService.AllProjectItems.
                        Where(t => t.Type == ProjectItem.Types.StagingEntity).
                        Select(t => new EntitySelect { IsSelected = false, Name = t.Name.Substring(0, t.Name.Length - 5), RelativePath = t.RelativeFilePath, FilePath = t.FilePath })
                        );
                foreach (var e in this.Entities)
                {
                    e.PropertyChanged += this.DataSourceEditViewModel_PropertyChanged;
                }
            }
            catch (Exception ex)
            {
                this.dialogService.ShowException(this, ex);
            }
        }

        private async void DataSourceEditViewModel_PropertyChanged(object sender, System.ComponentModel.PropertyChangedEventArgs e)
        {
            switch (e.PropertyName)
            {
                case nameof(this.SelectedDataProduct):
                    this.DataModules = new ObservableCollection<DataModule>(this.SelectedDataProduct.Module);
                    break;
                case nameof(this.SelectedIndex):
                    if (this.SelectedIndex == 0)
                    {
                        this.WizardCanComplete = false;
                    }
                    else if (this.SelectedIndex == 1)
                    {
                        this.FillDefaultCoreEntities();
                        this.WizardCanComplete = false;
                    }
                    else if (this.SelectedIndex == 2)
                    {
                        await this.FillCoreModel();
                        this.WizardCanComplete = true;
                    }
                    break;
                case nameof(EntitySelect.IsSelected):
                    if (this.SelectedIndex == 0)
                    {
                        if (this.Entities.Where(e => e.IsSelected).Any())
                        {
                            this.IsNextEnabled = true;
                            this.NumSelectablePages = 2;
                        }
                        else
                        {
                            this.NumSelectablePages = 1;
                            this.IsNextEnabled = false;
                        }
                    }
                    break;
                case nameof(this.Name):
                    if (this.RelativePath != null)
                    {
                        var relativePathSplit = this.RelativePath.Split("\\");
                        relativePathSplit[relativePathSplit.Length - 1] = this.Name + ".json";
                        this.RelativePath = relativePathSplit.ToSeparatorList("\\");
                        this.CanSelectPage3();
                    }
                    break;
                case nameof(this.RelativePath):
                case nameof(this.SelectedDataModule):
                    this.CanSelectPage3();
                    break;

            }
            await Task.Yield();
        }

        private void CanSelectPage3()
        {
            if (this.SelectedIndex == 1)
            {
                if (!String.IsNullOrWhiteSpace(this.Name) &&
                    !String.IsNullOrWhiteSpace(this.RelativePath) &&
                    this.SelectedDataModule != null)
                {
                    this.NumSelectablePages = 3;
                    this.IsNextEnabled = true;
                }
                else
                {
                    this.NumSelectablePages = 2;
                    this.IsNextEnabled = false;
                }
            }
            else if (this.SelectedIndex == 2)
            {
                // summary
            }
        }

        private async Task FillCoreModel()
        {
            // 
            this.CoreModel = new ModelEntry
            {
                Entity = new CoreEntity
                {
                    DataProduct = this.SelectedDataProduct.Name,
                    DataModule = this.SelectedDataModule.Name,
                    Name = this.Name,
                    DisplayName = this.DisplayName,
                },
                Function = new CoreFunction
                {
                    Source = new ObservableCollection<SourceEntity>
                    {
                        // default entry for non-mapped attributes
                        new SourceEntity
                        {
                            Dm8l = "#",
                            Mapping = new ObservableCollection<Mapping>()
                        }
                    }
                }
            };

            // mapping and functions for mapped attributes
            foreach (var entrySelected in this.SelectedEntities)
            {
                StageModelReader sourceEntityValidator = new StageModelReader();
                var modelEntry = await sourceEntityValidator.ReadFromFileAsync(entrySelected.FilePath);

                this.CoreModel.Function.Source.Add(new SourceEntity
                {
                    Dm8l = modelEntry.Entity.Dm8l,
                    Mapping = new ObservableCollection<Mapping>(modelEntry.Entity.Attribute.Select(a => new Mapping { Name = null, SourceName = a.Name }))
                });

                // add distinct list of attributes by default
            }


        }

        private void FillDefaultCoreEntities()
        {
            this.SelectedEntities = new ObservableCollection<EntitySelect>(this.Entities.Where(e => e.IsSelected));
            this.Name = this.SelectedEntities.First().Name;
            this.DisplayName = Name;
            this.RelativePath = this.SelectedEntities.First().RelativePath;
            string prod = this.RelativePath.Substring(0, this.RelativePath.IndexOf(Path.DirectorySeparatorChar));
            this.SelectedDataProduct = this.DataProducts.Where(m => m.Name == prod).FirstOrDefault();
            string rest = this.RelativePath.Substring(this.RelativePath.IndexOf(Path.DirectorySeparatorChar) + 1);
            string mod = rest.Substring(0, rest.IndexOf(Path.DirectorySeparatorChar));
            if (this.DataModules != null)
                this.SelectedDataModule = this.DataModules.Where(m => m.Name == mod).FirstOrDefault();
        }

        private async void OnOK(IClosableWindow window)
        {
            try
            {
                if (this.CoreModel != null)
                {

                    this.RelativePath = Path.Combine(this.CoreModel.Entity.DataProduct,
                        this.CoreModel.Entity.DataModule, this.CoreModel.Entity.Name + ".json");

                    var path = Path.Combine(this.solutionService.Solution.CoreFolderPath, this.RelativePath);

                    // handle file exits
                    if (File.Exists(path))
                    {
                        var overwrite = this.dialogService.ShowMessageBox(this,
                            "The file already exists. Do you want to overwrite the file?", "File already exists",
                            MessageBoxButton.YesNoCancel);
                        if (overwrite == MessageBoxResult.No)
                        {
                            return;
                        }

                        if (overwrite == MessageBoxResult.Cancel)
                        {
                            window.DialogResult = false;
                            this.DialogResult = false;

                            window.Close();
                            return;
                        }
                    }

                    // create or overwrite file
                    await this.solutionService.SolutionHelper.SaveModelEntryAsync(this.CoreModel.Entity.Dm8l, this.CoreModel, path);
                }

                window.DialogResult = true;
                this.DialogResult = true;

                window.Close();
            }
            catch (Exception ex)
            {
                this.dialogService.ShowException(this, ex);
            }
        }

        private void OnCancel(IClosableWindow window)
        {
            window.DialogResult = false;
            this.DialogResult = false;
        }
    }
}

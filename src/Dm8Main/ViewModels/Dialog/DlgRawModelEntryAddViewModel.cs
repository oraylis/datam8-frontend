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
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Composition;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Dm8Data.DataProducts;
using Dm8Data.DataSources;
using Dm8Data.Helper;
using Dm8Data.Raw;
using Dm8Data.Source;
using Dm8Data.Validate;
using Dm8Main.Base;
using Dm8Main.Services;
using Oraylis.DataM8.PluginBase.BaseClasses;
using Oraylis.DataM8.PluginBase.Interfaces;
using MvvmDialogs;
using Newtonsoft.Json;
using Prism.Commands;


namespace Dm8Main.ViewModels.Dialog
{

    [Export]
    public class DlgRawModelEntryAddViewModel : Prism.Mvvm.BindableBase, IModalDialogViewModel, IHamburgerViewModel
    {
        private readonly IDialogService dialogService;

        private readonly ISolutionService solutionService;

        private readonly Dm8Data.Solution solution;

        public bool? DialogResult { get; set; }

        #region Property NumSelectablePages
        public int NumSelectablePages
        {
            get => this.numSelectablePages;
            set => this.SetProperty(ref this.numSelectablePages, value);
        }

        private int numSelectablePages;
        #endregion

        #region Property LoadedCommand
        public DelegateCommand LoadedCommand
        {
            get => this.loadedCommand;
            set => this.SetProperty(ref this.loadedCommand, value);
        }

        private DelegateCommand loadedCommand;
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

        #region Property SelectedIndex
        public int SelectedIndex
        {
            get => this.selectedIndex;
            set => this.SetProperty(ref this.selectedIndex, value);
        }

        private int selectedIndex;
        #endregion

        #region Property ConnectionProperty
        public object ConnectionProperty
        {
            get => this.connectionProperty;
            set => this.SetProperty(ref this.connectionProperty, value);
        }

        private object connectionProperty;
        #endregion

        #region Property ConnectionString
        public string ConnectionString
        {
            get => this.connectionString;
            set => this.SetProperty(ref this.connectionString, value);
        }

        private string connectionString;
        #endregion

        #region Property DataSources
        public ObservableCollection<DataSource> DataSources
        {
            get => this.dataSources;
            set => this.SetProperty(ref this.dataSources, value);
        }
        private ObservableCollection<DataSource> dataSources;
        #endregion

        #region Property SelectedDataSource
        public DataSource SelectedDataSource
        {
            get => this.selectedDataSource;
            set => this.SetProperty(ref this.selectedDataSource, value);
        }

        private DataSource selectedDataSource;
        #endregion

        #region Property DataProducts
        public ObservableCollection<Dm8Data.DataProducts.DataProduct> DataProducts
        {
            get => this.dataProducts;
            set => this.SetProperty(ref this.dataProducts, value);
        }
        private ObservableCollection<Dm8Data.DataProducts.DataProduct> dataProducts;
        #endregion

        #region Property SelectedDataProduct
        public Dm8Data.DataProducts.DataProduct SelectedDataProduct
        {
            get => this.selectedDataProduct;
            set => this.SetProperty(ref this.selectedDataProduct, value);
        }
        private Dm8Data.DataProducts.DataProduct selectedDataProduct;
        #endregion

        #region Property DataModules
        public ObservableCollection<Dm8Data.DataProducts.DataModule> DataModules
        {
            get => this.dataModule;
            set => this.SetProperty(ref this.dataModule, value);
        }
        private ObservableCollection<Dm8Data.DataProducts.DataModule> dataModule;
        #endregion

        #region Property SelectedDataModule
        public Dm8Data.DataProducts.DataModule SelectedDataModule
        {
            get => this.selectedDataModule;
            set => this.SetProperty(ref this.selectedDataModule, value);
        }
        private Dm8Data.DataProducts.DataModule selectedDataModule;
        #endregion

        #region Property Entities
        public ObservableCollection<CheckableContent<Dm8Data.Raw.ModelEntry>> Entities
        {
            get => this.entities;
            set => this.SetProperty(ref this.entities, value);
        }
        private ObservableCollection<CheckableContent<Dm8Data.Raw.ModelEntry>> entities;
        #endregion

        #region Property SelectedEntry
        public CheckableContent<Dm8Data.Raw.ModelEntry> SelectedEntry
        {
            get => this.selectedEntry;
            set => this.SetProperty(ref this.selectedEntry, value);
        }
        private CheckableContent<Dm8Data.Raw.ModelEntry> selectedEntry;
        #endregion

        #region Property AddingEntity
        public string AddingEntity
        {
            get => this.addingEntity;
            set
            {
                this.SetProperty(ref this.addingEntity, value);
                App.AE();
            }
        }

        private string addingEntity;
        #endregion

        #region Property IsAddingEntities
        public bool IsAddingEntities
        {
            get => this.isAddingEntities;
            set
            {
                this.SetProperty(ref this.isAddingEntities, value);
                App.Wait(value);
            }
        }

        private bool isAddingEntities;
        #endregion


        public DlgRawModelEntryAddViewModel(IDialogService dialogService, ISolutionService solutionService)
        {
            this.dialogService = dialogService;
            this.solutionService = solutionService;
            this.solution = solutionService.Solution;

            this.PropertyChanged += this.DataSourceEditViewModel_PropertyChanged;
            this.OKCommand = new DelegateCommand<IClosableWindow>((w) => this.OnOK(w));
            this.CancelCommand = new DelegateCommand<IClosableWindow>((w) => this.OnCancel(w));
            this.LoadedCommand = new DelegateCommand(() => this.OnLoaded());
            this.IsNextEnabled = false;
        }

        private async void OnLoaded()
        {
            try
            {
                DataSourceModelReader dataSourceModelReader = new DataSourceModelReader();
                var dataSources = await dataSourceModelReader.ReadFromFileAsync(this.solution.DataSourcesFilePath);
                this.DataSources = new ObservableCollection<DataSource>(dataSources);

                DataProductModelReader dataProductModelReader = new DataProductModelReader();
                var dataProducts = await dataProductModelReader.ReadFromFileAsync(this.solution.DataProductsFilePath);
                this.DataProducts = new ObservableCollection<Dm8Data.DataProducts.DataProduct>(dataProducts);

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
                case nameof(this.SelectedDataSource):
                case nameof(this.SelectedDataProduct):
                case nameof(this.SelectedDataModule):
                case nameof(this.SelectedIndex):
                    if (this.SelectedDataProduct != null)
                    {
                        this.DataModules = new ObservableCollection<DataModule>(this.SelectedDataProduct.Module);
                    }
                    if (this.SelectedIndex == 0 &&
                        this.SelectedDataSource != null &&
                        this.SelectedDataProduct != null &&
                        this.SelectedDataModule != null)
                    {
                        this.IsNextEnabled = true;
                        this.NumSelectablePages = 2;
                    }
                    else if (this.SelectedIndex == 1)
                    {
                        this.IsNextEnabled = false;
                        this.NumSelectablePages = 2;
                        await this.LoadEntityList();
                    }
                    else if (this.SelectedIndex == 2)
                    {
                        await this.LoadAttributeList();
                        this.IsNextEnabled = true;
                        this.NumSelectablePages = 2;
                        this.SelectedIndex = 2;
                        this.IsNextEnabled = true;
                    }
                    break;
            }
        }

        private void EntryOnPropertyChanged(object? sender, PropertyChangedEventArgs e)
        {
            switch (e.PropertyName)
            {
                case nameof(CheckableContent<Dm8Data.Raw.ModelEntry>.IsChecked):
                    if (this.SelectedIndex == 1 && this.Entities.Count(e => e.IsChecked) > 0)
                    {
//                        _ = this.LoadAttributeList();
                        this.NumSelectablePages = 2;
                        this.IsNextEnabled = true;
                    }
                    else
                    {

                        this.NumSelectablePages = 2;
                        this.IsNextEnabled = false;
                    }
                    break;
            }
        }

        private async Task LoadEntityList()
        {
            try
            {
                this.IsAddingEntities = true;
                this.AddingEntity = "Scanning Remote...";

                var dsCheck = DataSourceExplorerFactory.Create(this.SelectedDataSource.Type);

                if (dsCheck is IDm8PluginConnectorSourceExplorerV1 ds)
                {
                    this.IsNextEnabled = false;
                    ds = (IDm8PluginConnectorSourceExplorerV1)dsCheck;
                    ds.Source =
                        Oraylis.DataM8.PluginBase.Extensions.Extensions.ConvertClass<DataSourceBase, DataSource>(
                            this.SelectedDataSource);
                    ds.Layer = Dm8Data.Properties.Resources.Folder_Raw;
                    ds.DataProduct = this.SelectedDataProduct.Name;
                    ds.DataModule = this.SelectedDataModule.Name;

                    var items = await ds.SelectObjects(delegate (string dm8l)
                    {
                        if (this.solutionService.SolutionHelper.GetFileName(dm8l) == null)
                        {
                            return (true);
                        }
                        return (false);
                    });

                    // refresh attributes on load
                    var dataTypeModelReader = new DataTypeModelReader();
                    var dataTypes = await dataTypeModelReader.ReadFromFileAsync(this.solution.DataTypesFilePath);

                    // add checked entities
                    foreach (var entry in items)
                    {
                        ModelEntry checkedEntity = Oraylis.DataM8.PluginBase.Extensions.Extensions.ConvertClass<ModelEntry, RawModelEntryBase>(entry);

                        // report entity name
                        this.AddingEntity = checkedEntity.Entity.Dm8l;

                        // serialize object
                        string folderName = Path.Combine(this.solution.RawFolderPath, checkedEntity.Entity.DataProduct,
                            checkedEntity.Entity.DataModule);
                        if (!Directory.Exists(folderName))
                        {
                            Directory.CreateDirectory(folderName);
                        }

                        string fileName = Path.Combine(folderName, checkedEntity.Entity.Name + ".json");
                        string jsonCode = FileHelper.MakeJson(checkedEntity);


                        await FileHelper.WriteFileAsync(fileName, jsonCode);

                    }

                    this.dialogService.Close(this);
                    this.DialogResult = items.Count > 0;
                    App.MainWindowViewModel.RefreshSolution();
                }

                #region Old Style
                if (dsCheck is IDataSourceExplorer ds1)
                {
                    ds1 = (IDataSourceExplorer)dsCheck;
                    ds1.Source = this.SelectedDataSource;
                    ds1.Layer = Dm8Data.Properties.Resources.Folder_Raw;
                    ds1.DataProduct = this.SelectedDataProduct.Name;
                    ds1.DataModule = this.SelectedDataModule.Name;
                    var rc = await ds1.QueryEntitiesAsync();
                    var newEntries = rc.Where(e =>
                        this.solutionService.SolutionHelper.GetFileName(e.Entity.Dm8l) == null &&
                        e.Entity.Dm8l != null);
                    var list = newEntries.Select(c => new CheckableContent<ModelEntry>(c as ModelEntry));
                    this.Entities = new ObservableCollection<CheckableContent<Dm8Data.Raw.ModelEntry>>(list);
                    foreach (var entry in this.Entities)
                    {
                        entry.CheckableChanged += EntryOnPropertyChanged;
                    }
                }
                #endregion

            }
            catch (Exception ex)
            {
                this.dialogService.ShowException(this, ex);
            }
            finally
            {
                this.IsAddingEntities = false;
                this.AddingEntity = "";

            }
        }

        private async Task LoadAttributeList()
        {
            try
            {
                this.IsAddingEntities = true;
                this.AddingEntity = "Scanning Attributes...";
                DataTypeModelReader dataTypeModelReader = new DataTypeModelReader();
                var dataTypes = await dataTypeModelReader.ReadFromFileAsync(this.solution.DataTypesFilePath);
                var ds = DataSourceExplorerFactory.Create(this.SelectedDataSource.Type);
                ds.Layer = Dm8Data.Properties.Resources.Folder_Raw;
                ds.DataProduct = this.SelectedDataProduct.Name;
                ds.DataModule = this.SelectedDataModule.Name;
                ds.Source = this.SelectedDataSource;
                await ds.RefreshAttributesAsync(this.SelectedEntry.Content);
            }
            catch (Exception ex)
            {
                this.dialogService.ShowException(this, ex);
            }
            finally
            {
                this.IsAddingEntities = false;
                this.AddingEntity = "";
            }
        }

        private async void OnOK(IClosableWindow window)
        {
            this.IsAddingEntities = true;
            try
            {
                if (this.SelectedEntry != null)
                {
                    // refresh attributes on load
                    var dataTypeModelReader = new DataTypeModelReader();
                    var dataTypes = await dataTypeModelReader.ReadFromFileAsync(this.solution.DataTypesFilePath);
                    var ds = (IDataSourceExplorer)DataSourceExplorerFactory.Create(this.SelectedDataSource.Type);
                    ds.Layer = Dm8Data.Properties.Resources.Folder_Raw;
                    ds.DataProduct = this.SelectedDataProduct.Name;
                    ds.DataModule = this.SelectedDataModule.Name;
                    ds.Source = this.SelectedDataSource;

                    // add checked entities
                    foreach (var checkedEntity in this.Entities.Where(e => e.IsChecked).Select(e => e.Content))
                    {
                        // report entity name
                        this.AddingEntity = checkedEntity.Entity.Dm8l;

                        // load attributes
                        await ds.RefreshAttributesAsync(checkedEntity);

                        // serialize object
                        string folderName = Path.Combine(this.solution.RawFolderPath, checkedEntity.Entity.DataProduct,
                            checkedEntity.Entity.DataModule);
                        if (!Directory.Exists(folderName))
                        {
                            Directory.CreateDirectory(folderName);
                        }

                        string fileName = Path.Combine(folderName, checkedEntity.Entity.Name + ".json");
                        string jsonCode = FileHelper.MakeJson(checkedEntity);

                        await FileHelper.WriteFileAsync(fileName, jsonCode);
                    }

                }

                window.DialogResult = true;
                this.DialogResult = true;
                window.Close();
            }
            catch (Exception ex)
            {
                this.dialogService.ShowException(this, ex);
            }
            finally
            {
                this.IsAddingEntities = false;
            }
        }

        private void OnCancel(IClosableWindow window)
        {
            window.DialogResult = false;
            this.DialogResult = false;
        }
    }
}

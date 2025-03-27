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
using System.Composition;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Forms;
using System.Windows.Input;
using Dm8Data;
using Dm8Data.DataSources;
using Dm8Data.Helper;
using Dm8Data.MessageOutput;
using Dm8Data.Source;
using Dm8Data.Validate;
using Dm8Data.Validate.Exceptions;
using Dm8Main.Base;
using Dm8Main.Models;
using Dm8Main.Properties;
using Dm8Main.Services;
using Dm8Main.Views;
using Dm8PluginBase.BaseClasses;
using Dm8PluginBase.Interfaces;
using Fluent;
using MvvmDialogs;
using Newtonsoft.Json;
using NJsonSchema.CodeGeneration.CSharp;
using Prism.Commands;
using Prism.Events;
using Unity;

namespace Dm8Main.ViewModels
{
    [Export]
    public class RawModelEntryViewModel : DocumentViewModel<Dm8Data.Raw.ModelEntry>
    {
        #region Property SelectedIndex
        public int SelectedIndex
        {
            get => this.selectedIndex;
            set => this.SetProperty(ref this.selectedIndex, value);
        }

        private int selectedIndex;
        #endregion

        #region Property AddSourceCommand
        public DelegateCommand AddSourceCommand
        {
            get => this.addSourceCommand;
            set => this.SetProperty(ref this.addSourceCommand, value);
        }

        private DelegateCommand addSourceCommand;
        #endregion

        #region Property EditSourceCommand
        public DelegateCommand EditSourceCommand
        {
            get => this.editSourceCommand;
            set => this.SetProperty(ref this.editSourceCommand, value);
        }

        private DelegateCommand editSourceCommand;
        #endregion

        #region Property RemoveSourceCommand
        public DelegateCommand RemoveSourceCommand
        {
            get => this.removeSourceCommand;
            set => this.SetProperty(ref this.removeSourceCommand, value);
        }

        private DelegateCommand removeSourceCommand;
        #endregion

        #region Property EditTargetCommand
        public DelegateCommand EditTargetCommand
        {
            get => this.editTargetCommand;
            set => this.SetProperty(ref this.editTargetCommand, value);
        }

        private DelegateCommand editTargetCommand;
        #endregion

        #region Property RefreshSourceCommand
        public DelegateCommand RefreshSourceCommand
        {
            get => this.refreshSourceCommand;
            set => this.SetProperty(ref this.refreshSourceCommand, value);
        }

        private DelegateCommand refreshSourceCommand;
        #endregion

        #region Property DeleteRowCommand
        public DelegateCommand DeleteRowCommand
        {
            get => this.deleteRowCommand;
            set => this.SetProperty(ref this.deleteRowCommand, value);
        }

        private DelegateCommand deleteRowCommand;
        #endregion

        #region Property EntityName
        public string EntityName
        {
            get => this.entityName;
            set => this.SetProperty(ref this.entityName, value);
        }

        private string entityName;
        #endregion

        public RawModelEntryViewModel(IUnityContainer unityContainer, ISolutionService solutionService, IEventAggregator eventAggregator, IDialogService dialogService)
            : base(unityContainer, solutionService, eventAggregator, dialogService)
        {
            this.Title = Properties.Resources.Title_RawEntity;
            this.RefreshSourceCommand = new DelegateCommand(async () => await this.RefreshSourceAsync());
            this.DeleteRowCommand = new DelegateCommand(this.DeleteRow);
            this.PropertyChanged += this.OnPropertyChanged;
        }

        private void OnPropertyChanged(object? sender, PropertyChangedEventArgs e)
        {
            if (e.PropertyName == nameof(this.Item) && this.Item.Entity != null)
            {
                this.Item.Entity.PropertyChanged += this.EntityOnPropertyChanged;
                this.EntityName = this.Item.Entity.Name;
            }
        }

        private async void EntityOnPropertyChanged(object? sender, PropertyChangedEventArgs e)
        {
            if (e.PropertyName == nameof(this.Item.Entity.Name))
            {
                await this.RenameEntity();
            }

        }

        private async Task<bool> RenameEntity()
        {
            // Change entity name
            var renameFile = this.ShowMessageBox(Resources.RawModelEntryViewModel_EntityOnPropertyChanged_Message,
                Resources.RawModelEntryViewModel_EntityOnPropertyChanged_Title,
                MessageBoxButton.YesNo);

            if (renameFile == MessageBoxResult.Yes)
            {
                try
                {
                    var newEntityName = this.Item.Entity.Name;
                    var oldEntityName = this.EntityName;

                    await this.solutionService.SolutionHelper.RenameEntityAsync(this.FilePath, oldEntityName, newEntityName);
                    this.ProjectItem.RenameEntity(this.FilePath, oldEntityName, newEntityName);
                    this.FilePath = this.ProjectItem.FilePath;
                    await base.SaveAsync();
                    this.EntityName = newEntityName;
                    return true;
                }
                catch (Exception ex)
                {
                    this.dialogService.ShowException(this, ex);
                }
            }
            return false;
        }

        protected override async Task SaveInternalAsync()
        {
            if (this.Item.Entity != null && this.Item.Entity.Name !=  this.EntityName)
                if (await this.RenameEntity())
                    return;

            // in case entity is renamed the rename method saves the object
            await base.SaveInternalAsync();
        }

        public void DeleteRow()
        {
            dialogService.ShowException(this, new Exception("Test"));
        }

        public async Task RefreshSourceAsync()
        {
            try
            {
                var info = string.Empty;
                var now = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
                var reader = ModelReaderFactory.Create(typeof(Dm8Data.Raw.ModelEntry));
                RawModelEntryBase modelEntry = Dm8PluginBase.Extensions.Extensions.ConvertClass<RawModelEntryBase, Dm8Data.Raw.ModelEntry>((Dm8Data.Raw.ModelEntry)await reader.ReadFromFileAsync(this.FilePath));
                if (modelEntry == null)
                {
                    info = "Cannot read entity";
                    return;
                }

                DataSourceModelReader dataSourceModelReader = new DataSourceModelReader();
                var dataSources = await dataSourceModelReader.ReadFromFileAsync(this.solution.DataSourcesFilePath);

                DataTypeModelReader dataTypeModelReader = new DataTypeModelReader();
                var dataTypes = await dataTypeModelReader.ReadFromFileAsync(this.solution.DataTypesFilePath);

                var dataSource = dataSources.FirstOrDefault(ds => modelEntry.Function.DataSource == ds.Name);

                // refresh data source
                IDm8PluginConnectorSourceExplorerV1 ds = (IDm8PluginConnectorSourceExplorerV1)DataSourceExplorerFactory.Create(dataSource.Type);
                ds.Source = Dm8PluginBase.Extensions.Extensions.ConvertClass<DataSourceBase, DataSource>(dataSource);
                ds.Layer = Dm8Data.Properties.Resources.Folder_Raw;
                ds.DataModule = modelEntry.Entity.DataModule;
                ds.DataProduct = modelEntry.Entity.DataProduct;
                await ds.RefreshAttributesAsync(modelEntry, true);
                var countUpdates = modelEntry.Entity.Attribute.Count(a => StringComparer.InvariantCultureIgnoreCase.Compare(a.DateModified, now) >= 0);
                var countDeletes = modelEntry.Entity.Attribute.Count(a => StringComparer.InvariantCultureIgnoreCase.Compare(a.DateDeleted, now) >= 0);
                if (countUpdates == 0 && countDeletes == 0)
                {
                    info = Resources.RawModelEntryViewModel_RefreshSourceResult_No_Change;
                }
                else
                {
                    info = string.Format(Resources.RawModelEntryViewModel_RefreshSourceResult, countUpdates, countDeletes);
                }
                this.eventAggregator.GetEvent<OutputItemEvent>().Publish(new OutputItem(new UpdateInfoException($"Refresh {modelEntry.Entity.DisplayName}: {info}", this.FilePath), this.solution));
                var JsonCode = FileHelper.MakeJson(modelEntry);

            }
            catch (Exception ex)
            {
                this.dialogService.ShowException(this, ex);
            }
        }

    }
}

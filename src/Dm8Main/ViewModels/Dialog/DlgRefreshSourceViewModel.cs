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
using System.Linq;
using System.Threading.Tasks;
using Dm8Data.DataSources;
using Dm8Data.Helper;
using Dm8Data.Source;
using Dm8Data.Validate;
using Dm8Main.Base;
using MvvmDialogs;
using Newtonsoft.Json;
using Oraylis.DataM8.PluginBase.BaseClasses;
using Oraylis.DataM8.PluginBase.Interfaces;
using Prism.Commands;

namespace Dm8Main.ViewModels.Dialog

{
#pragma warning disable CS1998

   [Export]
   public class DlgRefreshSourceViewModel:Prism.Mvvm.BindableBase, IModalDialogViewModel, IHamburgerViewModel
   {
      public class Item:Prism.Mvvm.BindableBase
      {
         #region Property Name
         public string Name
         {
            get => this.name;
            set => this.SetProperty(ref this.name ,value);
         }

         private string name;
         #endregion

         #region Property Folder
         public string Folder
         {
            get => this.folder;
            set => this.SetProperty(ref this.folder ,value);
         }

         private string folder;
         #endregion

         #region Property Info
         public string Info
         {
            get => this.info;
            set => this.SetProperty(ref this.info ,value);
         }

         private string info;
         #endregion

         #region Property RawEntry
         public Dm8Data.Raw.ModelEntry RawEntry
         {
            get => this.rawEntity;
            set => this.SetProperty(ref this.rawEntity ,value);
         }

         private Dm8Data.Raw.ModelEntry rawEntity;
         #endregion
      }

      private readonly IDialogService dialogService;

      private readonly Dm8Data.Solution solution;
      public bool? DialogResult { get; set; }

      #region Property NumSelectablePages
      public int NumSelectablePages
      {
         get => this.numSelectablePages;
         set => this.SetProperty(ref this.numSelectablePages ,value);
      }

      private int numSelectablePages;
      #endregion

      #region Property LoadedCommand
      public DelegateCommand LoadedCommand
      {
         get => this.loadedCommand;
         set => this.SetProperty(ref this.loadedCommand ,value);
      }

      private DelegateCommand loadedCommand;
      #endregion

      #region Property OKCommand
      public DelegateCommand<IClosableWindow> OKCommand
      {
         get => this.okCommand;
         set => this.SetProperty(ref this.okCommand ,value);
      }

      private DelegateCommand<IClosableWindow> okCommand;
      #endregion

      #region Property CancelCommand
      public DelegateCommand<IClosableWindow> CancelCommand
      {
         get => this.cancelCommand;
         set => this.SetProperty(ref this.cancelCommand ,value);
      }

      private DelegateCommand<IClosableWindow> cancelCommand;
      #endregion

      #region Property IsNextEnabled
      public bool IsNextEnabled
      {
         get => this.isNextEnabled;
         set => this.SetProperty(ref this.isNextEnabled ,value);
      }

      private bool isNextEnabled;
      #endregion

      #region Property SelectedIndex
      public int SelectedIndex
      {
         get => this.selectedIndex;
         set => this.SetProperty(ref this.selectedIndex ,value);
      }

      private int selectedIndex;
      #endregion

      #region Property ConnectionProperty
      public object ConnectionProperty
      {
         get => this.connectionProperty;
         set => this.SetProperty(ref this.connectionProperty ,value);
      }

      private object connectionProperty;
      #endregion

      #region Property ConnectionString
      public string ConnectionString
      {
         get => this.connectionString;
         set => this.SetProperty(ref this.connectionString ,value);
      }

      private string connectionString;
      #endregion

      #region Property DataSources
      public ObservableCollection<DataSource> DataSources
      {
         get => this.dataSources;
         set => this.SetProperty(ref this.dataSources ,value);
      }
      private ObservableCollection<DataSource> dataSources;
      #endregion

      #region Property SelectedDataSource
      public DataSource SelectedDataSource
      {
         get => this.selectedDataSource;
         set => this.SetProperty(ref this.selectedDataSource ,value);
      }

      private DataSource selectedDataSource;
      #endregion

      #region Property Entities
      public ObservableCollection<CheckableContent<Item>> Entities
      {
         get => this.entities;
         set => this.SetProperty(ref this.entities ,value);
      }
      private ObservableCollection<CheckableContent<Item>> entities;
      #endregion

      #region Property SelectedEntity
      public CheckableContent<Item> SelectedEntity
      {
         get => this.selectedEntity;
         set => this.SetProperty(ref this.selectedEntity ,value);
      }
      private CheckableContent<Item> selectedEntity;
      #endregion


      public DlgRefreshSourceViewModel(IDialogService dialogService ,Dm8Data.Solution solution)
      {
         this.dialogService = dialogService;
         this.solution = solution;

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
         } catch (Exception ex)
         {
            this.dialogService.ShowException(this ,ex);
         }
      }

      private async void DataSourceEditViewModel_PropertyChanged(object sender ,System.ComponentModel.PropertyChangedEventArgs e)
      {
         switch (e.PropertyName)
         {
            case nameof(this.SelectedDataSource):
            case nameof(this.SelectedIndex):
               if (this.SelectedIndex == 0 && this.SelectedDataSource != null)
               {
                  this.IsNextEnabled = true;
               } else if (this.SelectedIndex == 1)
               {
                  await this.LoadEntityList();
                  this.IsNextEnabled = true;
               } else if (this.SelectedIndex == 2)
               {
                  await this.RefreshAttributes();
                  this.IsNextEnabled = true;
                  this.NumSelectablePages = 2;
               }
               break;
            case nameof(this.SelectedEntity):
               break;
         }
      }

      private async Task LoadEntityList()
      {
         try
         {
            List<Item> rc = new List<Item>();

            foreach (var f in Directory.EnumerateFiles(this.solution.RawFolderPath ,"*.json" ,SearchOption.AllDirectories))
            {
               RawModelEntryBase m = JsonConvert.DeserializeObject<RawModelEntryBase>(File.ReadAllText(f));

               if (m.Function.DataSource == this.selectedDataSource.Name)
               {
                  Item sourceEntity = new Item();
                  sourceEntity.Name = Path.GetFileName(f);
                  sourceEntity.Folder = Path.GetDirectoryName(f);
                  rc.Add(sourceEntity);
               }
            }

            this.Entities = new ObservableCollection<CheckableContent<Item>>(rc.Select(i => new CheckableContent<Item>(i)));
         } catch (Exception ex)
         {
            this.dialogService.ShowException(this ,ex);
         }
      }

      private async Task RefreshAttributes()
      {

         try
         {
            if (this.SelectedEntity != null)
            {
               foreach (var item in this.Entities.Where(i => i.IsChecked).Select(i => i.Content))
               {
                  await this.RefreshItem(item);
               }
            } else
            {
               foreach (var item in this.Entities)
               {
                  await this.RefreshItem(item.Content);
               }
            }
         } catch (Exception ex)
         {
            this.dialogService.ShowException(this ,ex);
         }
      }

      private async Task RefreshItem(Item item)
      {
         // TODO efficient
         string now = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
         var reader = ModelReaderFactory.Create(typeof(Dm8Data.Raw.ModelEntry));
         var modelEntry = (Dm8Data.Raw.ModelEntry)await reader.ReadFromFileAsync(Path.Combine(item.Folder ,item.Name));
         if (modelEntry == null)
         {
            item.Info = "Cannot read entity";
            return;
         }

         #region New Style
         var dsCheck = DataSourceExplorerFactory.Create(this.SelectedDataSource.Type);
         if (dsCheck is IDm8PluginConnectorSourceExplorerV1 ds)
         {
            this.IsNextEnabled = false;
            ds = (IDm8PluginConnectorSourceExplorerV1)dsCheck;
            ds.Source = Oraylis.DataM8.PluginBase.Extensions.Extensions.ConvertClass<DataSourceBase ,DataSource>(this.SelectedDataSource);
            ds.Layer = Dm8Data.Properties.Resources.Folder_Raw;
            ds.DataModule = modelEntry.Entity.DataModule;
            ds.DataProduct = modelEntry.Entity.DataProduct;
            if (!modelEntry.Function.SourceLocation.ToLower().EndsWith(".csv"))
            {
               await ds.RefreshAttributesAsync(Oraylis.DataM8.PluginBase.Extensions.Extensions
                   .ConvertClass<RawModelEntryBase ,Dm8Data.Raw.ModelEntry>(modelEntry));
            }
         }
         #endregion

         #region Old Style
         if (dsCheck is IDataSourceExplorer ds1)
         {
            ds1 = (IDataSourceExplorer)dsCheck;
            ds1.Source = this.SelectedDataSource;
            ds1.Layer = Dm8Data.Properties.Resources.Folder_Raw;
            ds1.DataModule = modelEntry.Entity.DataModule;
            ds1.DataProduct = modelEntry.Entity.DataProduct;

            await ds1.RefreshAttributesAsync(modelEntry);
         }
         #endregion

         var countUpdates = modelEntry.Entity.Attribute.Count(a =>
             StringComparer.InvariantCultureIgnoreCase.Compare(a.DateModified ,now) >= 0);
         var countDeletes = modelEntry.Entity.Attribute.Count(a =>
             StringComparer.InvariantCultureIgnoreCase.Compare(a.DateDeleted ,now) >= 0);
         if (countUpdates == 0 && countDeletes == 0)
         {
            item.Info = "No Change";
            return;
         }
         item.Info = $"Changes #{countUpdates}; Deleted #{countDeletes}";
         item.RawEntry = modelEntry;
      }

      private async void OnOK(IClosableWindow window)
      {
         try
         {
            if (this.SelectedEntity != null && this.SelectedEntity.Content.RawEntry != null)
            {
               string jsonCode = FileHelper.MakeJson(this.SelectedEntity.Content.RawEntry);

               await FileHelper.WriteFileAsync(Path.Combine(this.SelectedEntity.Content.Folder ,this.SelectedEntity.Content.Name) ,jsonCode);
            } else
            {
               foreach (var item in this.Entities.Select(i => i.Content))
               {
                  if (item.RawEntry != null)
                  {
                     string jsonCode = FileHelper.MakeJson(item.RawEntry);

                     await FileHelper.WriteFileAsync(Path.Combine(item.Folder ,item.Name) ,jsonCode);
                  }
               }
            }

            if (this.SelectedEntity != null)
            {

            }
            window.DialogResult = true;
            this.DialogResult = true;
            window.Close();
         } catch (Exception ex)
         {
            this.dialogService.ShowException(this ,ex);
         }
      }

      private void OnCancel(IClosableWindow window)
      {
         window.DialogResult = false;
         this.DialogResult = false;
      }

   }
}

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

using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Composition;
using Dm8Data.DataSources;
using Dm8Main.Models;
using Dm8Main.Services;
using Dm8Main.ViewModels.Dialog;
using MvvmDialogs;
using Prism.Commands;
using Prism.Events;
using Unity;

namespace Dm8Main.ViewModels
{
   [Export]
   public class DataSourcesViewModel:DocumentListViewModel<Dm8Data.DataSources.DataSource ,Dm8Data.DataSources.DataSources>
   {
      private readonly IUnityContainer unityContainer;

      #region Property AddSourceCommand
      public DelegateCommand AddSourceCommand
      {
         get => this.addSourceCommand;
         set => this.SetProperty(ref this.addSourceCommand ,value);
      }

      public DelegateCommand addSourceCommand;
      #endregion

      #region Property EditSourceCommand
      public DelegateCommand EditSourceCommand
      {
         get => this.editSourceCommand;
         set => this.SetProperty(ref this.editSourceCommand ,value);
      }

      public DelegateCommand editSourceCommand;
      #endregion

      #region Property RemoveSourceCommand
      public DelegateCommand RemoveSourceCommand
      {
         get => this.removeSourceCommand;
         set => this.SetProperty(ref this.removeSourceCommand ,value);
      }

      public DelegateCommand removeSourceCommand;
      #endregion

      #region Property SelectedItem
      public new DataSource SelectedItem
      {
         get => _selectedItem;
         set
         {
            SetProperty(ref _selectedItem ,value);
            this.SelectedItemEx = new DataSourceInfo(value);
         }

      }
      public DataSource _selectedItem;
      #endregion

      #region Property SelectedItemEx
      public DataSourceInfo SelectedItemEx
      {
         get => _selectedItemEx;
         set => SetProperty(ref _selectedItemEx ,value);
      }
      public DataSourceInfo _selectedItemEx;
      #endregion



      public DataSourcesViewModel(IUnityContainer container ,ISolutionService solutionService ,IEventAggregator eventAggregator ,IUnityContainer unityContainer ,IDialogService dialogService)
          : base(container ,solutionService ,eventAggregator ,dialogService)
      {
         this.unityContainer = unityContainer;
         this.dialogService = dialogService;

         this.Title = Properties.Resources.Title_DataSource;
         this.AddSourceCommand = new DelegateCommand(this.AddSource);
         this.EditSourceCommand = new DelegateCommand(this.EditSource);
         this.RemoveSourceCommand = new DelegateCommand(this.RemoveSource);
      }

      private void AddSource()
      {
         var addSourceViewModel = new DlgDataSourceEditViewModel(this.dialogService ,this.solution);


         if (this.dialogService.ShowDialog(this ,addSourceViewModel) ?? false)
         {
            if ((addSourceViewModel.isPlugin || addSourceViewModel.ConnectionProperty != null) && !string.IsNullOrEmpty(addSourceViewModel.ConnectionString))
            {
               if (addSourceViewModel.isPlugin)
               {
                  var newEntry = new Dm8Data.DataSources.DataSource
                  {
                     Name = addSourceViewModel.DataSourceName ,
                     Type = addSourceViewModel.PluginType ,
                     ConnectionString = addSourceViewModel.ConnectionString ,
                     DataTypeMapping = addSourceViewModel.DataTypeMappings ,
                     ExtendedProperties = addSourceViewModel.ExtendedProperties
                  };
                  this.Items.Add(newEntry);
               }
               else
               {
                  addSourceViewModel.DataTypeMappings = new ObservableCollection<Dm8Data.DataSources.DataTypeMapping>();
                  var newEntry = new Dm8Data.DataSources.DataSource
                  {
                     Name = addSourceViewModel.DataSourceName ,
                     Type = addSourceViewModel.ConnectionProperty.GetType().Name ,
                     ConnectionString = addSourceViewModel.ConnectionString ,
                     DataTypeMapping = addSourceViewModel.DataTypeMappings ,
                     ExtendedProperties = addSourceViewModel.ExtendedProperties
                  };
                  this.Items.Add(newEntry);
               }
            }
         }
      }

      private void EditSource()
      {
         if (this.SelectedItem == null)
         {
            return;
         }

         var viewModel = new DlgDataSourceEditViewModel(this.dialogService ,this.solution)
         {
            DataSourceName = this.SelectedItem.Name ,
            SelectedItem = this.SelectedItem.Type ,
            ConnectionString = this.SelectedItem.ConnectionString ,
            DataTypeMappings = this.SelectedItem.DataTypeMapping == null ?
                    new ObservableCollection<Dm8Data.DataSources.DataTypeMapping>() :
                    new ObservableCollection<Dm8Data.DataSources.DataTypeMapping>(this.SelectedItem.DataTypeMapping) ,
            ExtendedProperties = this.SelectedItem.ExtendedProperties == null ?
                new Dictionary<string ,string>() : this.SelectedItem.ExtendedProperties
         };
         if (this.dialogService.ShowDialog(this ,viewModel) ?? false)
         {

            if ((viewModel.isPlugin || viewModel.ConnectionProperty != null) && !string.IsNullOrEmpty(viewModel.ConnectionString))
            {
               this.SelectedItem.Name = viewModel.DataSourceName;
               if (viewModel.isPlugin)
               {
                  this.SelectedItem.Type = viewModel.PluginType;
               }
               else
               {
                  this.SelectedItem.Type = viewModel.ConnectionProperty.GetType().Name;
               }
               this.SelectedItem.ConnectionString = viewModel.ConnectionString;
               this.SelectedItem.DataTypeMapping = viewModel.DataTypeMappings;
               this.SelectedItem.ExtendedProperties = viewModel.ExtendedProperties;
            }

         }
      }

      private void RemoveSource()
      {
         if (this.SelectedItem == null)
         {
            return;
         }

         this.Items.Remove(this.SelectedItem);
      }

   }
}

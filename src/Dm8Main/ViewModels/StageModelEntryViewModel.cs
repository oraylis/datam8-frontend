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

using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Composition;
using System.Threading.Tasks;
using Dm8Data.DataTypes;
using Dm8Data.Validate;
using Dm8Main.Services;
using MvvmDialogs;
using Prism.Events;
using Unity;

namespace Dm8Main.ViewModels
{
   [Export]
   public class StageModelEntryViewModel:DocumentViewModel<Dm8Data.Stage.ModelEntry>
   {
      #region Property SelectedIndex
      public int SelectedIndex
      {
         get => this.selectedIndex;
         set => this.SetProperty(ref this.selectedIndex ,value);
      }

      private int selectedIndex;
      #endregion

      #region Property DataTypes
      public ObservableCollection<Dm8Data.DataTypes.DataType> DataTypes
      {
         get => this.dataTypes;
         set => this.SetProperty(ref this.dataTypes ,value);
      }

      private ObservableCollection<Dm8Data.DataTypes.DataType> dataTypes;
      #endregion

      #region Property StageEntities
      public ObservableCollection<Dm8Data.Stage.ModelEntry> StageEntries
      {
         get => this.stageEntries;
         set => this.SetProperty(ref this.stageEntries ,value);
      }

      private ObservableCollection<Dm8Data.Stage.ModelEntry> stageEntries;
      #endregion

      public StageModelEntryViewModel(IUnityContainer unityContainer ,ISolutionService solutionService ,IEventAggregator eventAggregator ,IDialogService dialogService)
          : base(unityContainer ,solutionService ,eventAggregator ,dialogService)
      {
         this.Title = Properties.Resources.Title_RawEntity;
         this.PropertyChanged += this.StageEntityViewModel_PropertyChanged;

         this.StageEntries = new ObservableCollection<Dm8Data.Stage.ModelEntry>();
      }

      private void StageEntityViewModel_PropertyChanged(object? sender ,PropertyChangedEventArgs e)
      {
         switch (e.PropertyName)
         {
            case nameof(this.Item):
               break;
         }
      }

      protected override async Task LoadInternalAsync()
      {
         // read stage item
         await base.LoadInternalAsync();

         DataTypeModelReader dataTypeModelReader = new DataTypeModelReader();
         var dataTypes = await dataTypeModelReader.ReadFromFileAsync(this.solution.DataTypesFilePath);
         this.DataTypes = new ObservableCollection<DataType>(dataTypes);
      }

   }
}

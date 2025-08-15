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
using System.Composition;
using System.Linq;
using Dm8Data.Curated;
using Dm8Main.Services;
using Dm8Main.ViewModels.Dialog;
using MvvmDialogs;
using Prism.Commands;
using Prism.Events;
using Unity;
using Resources = Dm8Data.Properties.Resources;

namespace Dm8Main.ViewModels
{
   [Export]
   public class CuratedFunctionViewModel:Prism.Mvvm.BindableBase
   {
      private readonly CuratedModelEntryViewModel curatedModelEntryViewModel;
      private readonly IUnityContainer unityContainer;
      private readonly ISolutionService solutionService;
      private readonly IEventAggregator eventAggregator;
      private readonly IDialogService dialogService;

      #region Property CuratedFunction
      public CuratedFunction CuratedFunction
      {
         get => this.curatedFunction;
         set => this.SetProperty(ref this.curatedFunction ,value);
      }

      private CuratedFunction curatedFunction;
      #endregion

      #region Property MergeList
      public List<KeyValuePair<CuratedFunctionMerge_type ,string>> MergeList
      {
         get => this.mergeList;
         set => this.SetProperty(ref this.mergeList ,value);
      }

      private List<KeyValuePair<CuratedFunctionMerge_type ,string>> mergeList;
      #endregion

      #region Property FrequencyList
      public List<KeyValuePair<CuratedFunctionFrequency ,string>> FrequencyList
      {
         get => this.frequencyList;
         set => this.SetProperty(ref this.frequencyList ,value);
      }

      private List<KeyValuePair<CuratedFunctionFrequency ,string>> frequencyList;
      #endregion

      #region Property EditCommand
      public DelegateCommand EditCommand
      {
         get => this.editCommand;
         set => this.SetProperty(ref this.editCommand ,value);
      }

      private DelegateCommand editCommand;
      #endregion

      public CuratedFunctionViewModel(CuratedModelEntryViewModel curatedModelEntryViewModel ,CuratedFunction curatedFunction ,IUnityContainer unityContainer ,ISolutionService solutionService ,IEventAggregator eventAggregator ,IDialogService dialogService)
      {
         this.curatedModelEntryViewModel = curatedModelEntryViewModel;
         this.unityContainer = unityContainer;
         this.solutionService = solutionService;
         this.eventAggregator = eventAggregator;
         this.dialogService = dialogService;

         this.EditCommand = new DelegateCommand(this.Edit);
         this.CuratedFunction = curatedFunction;

         var mergeList = new List<KeyValuePair<CuratedFunctionMerge_type ,string>>();
         mergeList.Add(new KeyValuePair<CuratedFunctionMerge_type ,string>(CuratedFunctionMerge_type.Replace ,
             Resources.CuratedFunctionViewModel_replace));
         mergeList.Add(new KeyValuePair<CuratedFunctionMerge_type ,string>(CuratedFunctionMerge_type.Merge ,
             Resources.CuratedFunctionViewModel_merge));
         mergeList.Add(new KeyValuePair<CuratedFunctionMerge_type ,string>(CuratedFunctionMerge_type.Partition ,
             Resources.CuratedFunctionViewModel_partition));
         mergeList.Add(new KeyValuePair<CuratedFunctionMerge_type ,string>(CuratedFunctionMerge_type.Self ,
             Resources.CuratedFunctionViewModel_self));
         this.MergeList = mergeList;

         var frequenceList = new List<KeyValuePair<CuratedFunctionFrequency ,string>>();
         frequenceList.Add(new KeyValuePair<CuratedFunctionFrequency ,string>(CuratedFunctionFrequency.No_restriction ,
             Resources.CuratedFunctionViewModel_no_restriction));
         frequenceList.Add(new KeyValuePair<CuratedFunctionFrequency ,string>(CuratedFunctionFrequency.Daily ,
             Resources.CuratedFunctionViewModel_daily));
         frequenceList.Add(new KeyValuePair<CuratedFunctionFrequency ,string>(CuratedFunctionFrequency.Weekly ,
             Resources.CuratedFunctionViewModel_weekly));
         frequenceList.Add(new KeyValuePair<CuratedFunctionFrequency ,string>(CuratedFunctionFrequency.Monthly ,
             Resources.CuratedFunctionViewModel_monthly));
         frequenceList.Add(new KeyValuePair<CuratedFunctionFrequency ,string>(CuratedFunctionFrequency.Yearly ,
             Resources.CuratedFunctionViewModel_yearly));
         this.FrequencyList = frequenceList;
      }

      private void Edit()
      {
         var viewModel = new DlgCuratedEntityEditViewModel(this.dialogService ,this.solutionService);
         viewModel.IsNewMode = false;
         viewModel.SelectedSourceEntities = this.CuratedFunction.Source.Select(e => e.Dm8l);
         if (this.dialogService.ShowDialog(this.curatedModelEntryViewModel ,viewModel) ?? false)
         {
            this.CuratedFunction.Source.Clear();
            foreach (var entitySelect in viewModel.Entities.Where(e => e.IsSelected))
            {
               var dm8l = this.solutionService.SolutionHelper.GetDm8lFromFileName(entitySelect.FilePath);
               this.CuratedFunction.Source.Add(new ComputationSourceEntity { Dm8l = dm8l.Value });
            }

         }
      }
   }
}

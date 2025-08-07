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
using System.Composition;
using System.Linq;
using System.Threading.Tasks;
using Dm8Main.Base;
using Dm8Main.Models;
using Dm8Main.Services;
using MvvmDialogs;
using Prism.Commands;

namespace Dm8Main.ViewModels.Dialog
{

   [Export]
   public class DlgCoreAttributeAssignViewModel:Prism.Mvvm.BindableBase, IModalDialogViewModel
   {
      private readonly ISolutionService solutionService;

      private readonly IDialogService dialogService;

      public bool? DialogResult { get; set; }

      #region Property LoadedCommand
      public DelegateCommand LoadedCommand
      {
         get => this.loadedCommand;
         set => this.SetProperty(ref this.loadedCommand ,value);
      }

      private DelegateCommand loadedCommand;
      #endregion

      #region Property Attribute
      public Dm8Data.Core.Attribute Attribute
      {
         get => this.attribute;
         set => this.SetProperty(ref this.attribute ,value);
      }
      public Dm8Data.Core.Attribute attribute;
      #endregion

      #region Property AttributeMapping
      public ObservableCollection<CheckableContent<MappingEntry>> AttributeMapping
      {
         get => this.attributeMapping;
         set => this.SetProperty(ref this.attributeMapping ,value);
      }
      public ObservableCollection<CheckableContent<MappingEntry>> attributeMapping;
      #endregion

      #region Property AttributeAll_Filtered
      public ObservableCollection<CheckableContent<MappingEntry>> AttributeAll_Filtered
      {
         get => this.attributeAll_Filtered;
         set => this.SetProperty(ref this.attributeAll_Filtered ,value);
      }
      public ObservableCollection<CheckableContent<MappingEntry>> attributeAll_Filtered;
      #endregion

      #region Property AttributeAll
      public ObservableCollection<CheckableContent<MappingEntry>> AttributeAll
      {
         get => this.attributeAll;
         set => this.SetProperty(ref this.attributeAll ,value);
      }
      public ObservableCollection<CheckableContent<MappingEntry>> attributeAll;
      #endregion

      #region Property IsShowMapped
      public bool IsShowMapped
      {
         get => this.isShowMapped;
         set => this.SetProperty(ref this.isShowMapped ,value);
      }
      public bool isShowMapped;
      #endregion

      #region Property AddSourceAttributesCommand
      public DelegateCommand AddSourceAttributesCommand
      {
         get => this.addSourceAttributesCommand;
         set => this.SetProperty(ref this.addSourceAttributesCommand ,value);
      }

      public DelegateCommand addSourceAttributesCommand;
      #endregion

      #region Property RemoveSourceAttributesCommand
      public DelegateCommand RemoveSourceAttributesCommand
      {
         get => this.removeSourceAttributesCommand;
         set => this.SetProperty(ref this.removeSourceAttributesCommand ,value);
      }

      public DelegateCommand removeSourceAttributesCommand;
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

      public DlgCoreAttributeAssignViewModel(IDialogService dialogService ,ISolutionService solutionService)
      {
         this.solutionService = solutionService;
         this.dialogService = dialogService;

         this.PropertyChanged += this.DlgCoreAttributeEditViewModel_PropertyChanged;
         this.OKCommand = new DelegateCommand<IClosableWindow>(this.OnOK);
         this.CancelCommand = new DelegateCommand<IClosableWindow>(this.OnCancel);
         this.LoadedCommand = new DelegateCommand(this.OnLoaded);
         this.AddSourceAttributesCommand = new DelegateCommand(AddSourceAttributes);
         this.RemoveSourceAttributesCommand = new DelegateCommand(RemoveSourceAttributes);
         this.IsShowMapped = true;
      }

      private async void OnLoaded()
      {
         try
         {
            await Task.Yield();
         } catch (Exception ex)
         {
            this.dialogService.ShowException(this ,ex);
         }
      }

      private async void DlgCoreAttributeEditViewModel_PropertyChanged(object sender ,System.ComponentModel.PropertyChangedEventArgs e)
      {
         switch (e.PropertyName)
         {
            case nameof(AttributeAll):
               this.AttributeAll_Filtered =
                   new ObservableCollection<CheckableContent<MappingEntry>>(
                       this.AttributeAll.Where(a => string.IsNullOrEmpty(a.Content.Name)));
               break;
            case nameof(IsShowMapped):
               if (this.IsShowMapped == true && this.AttributeAll != null)
               {
                  this.AttributeAll_Filtered =
                      new ObservableCollection<CheckableContent<MappingEntry>>(
                          this.AttributeAll.Where(a => string.IsNullOrEmpty(a.Content.Name)));
               } else if (this.AttributeAll != null)
               {
                  this.AttributeAll_Filtered =
                      new ObservableCollection<CheckableContent<MappingEntry>>(this.AttributeAll);
               }

               break;
         }
         await Task.Yield();
      }

      private async void OnOK(IClosableWindow window)
      {
         try
         {
            await Task.Yield();
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

      private void AddSourceAttributes()
      {
         var attrToAdd = this.AttributeAll_Filtered.Where(a => a.IsChecked).ToList();
         foreach (var a in attrToAdd)
         {
            if (!this.AttributeMapping.Any(am => am.Content.StageEntity.Dm8l == a.Content.StageEntity.Dm8l &&
                                                 am.Content.SourceName == a.Content.SourceName))
            {
               a.Content.Name = this.Attribute.Name;
               this.AttributeMapping.Add(a);
               if (this.IsShowMapped)
               {
                  this.AttributeAll_Filtered.Remove(a);
               }
            }
         }
      }

      private void RemoveSourceAttributes()
      {
         var attrToAdd = this.AttributeMapping.Where(a => a.IsChecked).ToList();
         foreach (var a in attrToAdd)
         {
            this.AttributeMapping.Remove(a);
            a.Content.Name = null;
            if (this.IsShowMapped)
            {
               this.AttributeAll_Filtered.Add(a);
            }
         }
      }
   }
}

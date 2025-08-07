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
using Dm8Data.Validate;
using Dm8Locator.Dm8l;
using Dm8Main.Base;
using Dm8Main.Models;
using Dm8Main.Services;
using MvvmDialogs;
using Prism.Commands;
using Attribute = Dm8Data.Core.Attribute;

namespace Dm8Main.ViewModels.Dialog
{

   [Export]
   public class DlgCoreEntityEditRelationshipViewModel:Prism.Mvvm.BindableBase, IModalDialogViewModel
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

      #region Property WizardCanComplete
      public bool WizardCanComplete
      {
         get => this.wizardCanComplete;
         set => this.SetProperty(ref this.wizardCanComplete ,value);
      }

      private bool wizardCanComplete;
      #endregion

      #region Property SelectedIndex
      public int SelectedIndex
      {
         get => this.selectedIndex;
         set => this.SetProperty(ref this.selectedIndex ,value);
      }

      private int selectedIndex;
      #endregion

      #region Property NumSelectablePages
      public int NumSelectablePages
      {
         get => this.numSelectablePages;
         set => this.SetProperty(ref this.numSelectablePages ,value);
      }

      private int numSelectablePages;
      #endregion

      #region Property Entities
      public ObservableCollection<EntitySelect> Entities
      {
         get => this.entities;
         set => this.SetProperty(ref this.entities ,value);
      }

      private ObservableCollection<EntitySelect> entities;
      #endregion

      #region Property CoreEntity
      public Dm8Data.Core.CoreEntity CoreEntity
      {
         get => this.coreEntity;
         set => this.SetProperty(ref this.coreEntity ,value);
      }

      private Dm8Data.Core.CoreEntity coreEntity;
      #endregion

      #region Property Relationship
      public Dm8Data.Core.Relationship Relationship
      {
         get => this.relationship;
         set => this.SetProperty(ref this.relationship ,value);
      }

      private Dm8Data.Core.Relationship relationship;
      #endregion

      #region Property Role
      public string Role
      {
         get => this.role;
         set => this.SetProperty(ref this.role ,value);
      }

      private string role;
      #endregion

      #region Property KeyCoreModel
      public Dm8Data.Core.ModelEntry KeyCoreModel
      {
         get => this.keyCoreModel;
         set => this.SetProperty(ref this.keyCoreModel ,value);
      }

      private Dm8Data.Core.ModelEntry keyCoreModel;
      #endregion

      #region Property KeyAttributes
      public ObservableCollection<EditRelationshipAttribute> KeyAttributes
      {
         get => this.keyAttributes;
         set => this.SetProperty(ref this.keyAttributes ,value);
      }

      private ObservableCollection<EditRelationshipAttribute> keyAttributes;
      #endregion

      #region Property Path
      public string RelativePath
      {
         get => this.path;
         set => this.SetProperty(ref this.path ,value);
      }

      private string path;
      #endregion

      #region Property SelectedEntities
      public EntitySelect SelectedEntity
      {
         get => this.selectedEntity;
         set => this.SetProperty(ref this.selectedEntity ,value);
      }

      private EntitySelect selectedEntity;
      #endregion


      public DlgCoreEntityEditRelationshipViewModel(IDialogService dialogService ,ISolutionService solutionService)
      {
         this.solutionService = solutionService;
         this.dialogService = dialogService;

         this.PropertyChanged += this.DataSourceEditViewModel_PropertyChanged;
         this.OKCommand = new DelegateCommand<IClosableWindow>(this.OnOK);
         this.CancelCommand = new DelegateCommand<IClosableWindow>(this.OnCancel);
         this.LoadedCommand = new DelegateCommand(async () => await this.OnLoadedAsync());
         this.IsNextEnabled = false;
         this.SelectedIndex = 0;
         this.NumSelectablePages = 1;
      }

      private async Task OnLoadedAsync()
      {
         try
         {
            this.Entities = new ObservableCollection<EntitySelect>(
                this.solutionService.AllProjectItems.
                    Where(t => t.Type == ProjectItem.Types.CoreEntity).
                    Select(t => new EntitySelect { IsSelected = false ,Name = t.Name.Substring(0 ,t.Name.Length - 5) ,RelativePath = t.RelativeFilePath ,FilePath = t.FilePath })
            );

            if (this.Relationship != null)
            {
               this.SelectedEntity = this.Entities.FirstOrDefault(e => this.Relationship.Dm8lKey.EndsWith(e.Name));
               this.SelectedIndex = 1;
            }
         } catch (Exception ex)
         {
            this.dialogService.ShowException(this ,ex);
         }

         await Task.Yield();
      }

      private async void DataSourceEditViewModel_PropertyChanged(object sender ,System.ComponentModel.PropertyChangedEventArgs e)
      {
         switch (e.PropertyName)
         {
            case nameof(this.SelectedIndex):
               if (this.SelectedIndex == 0)
               {
                  this.WizardCanComplete = false;
               } else if (this.SelectedIndex == 1)
               {
                  this.WizardCanComplete = false;
               } else if (this.SelectedIndex == 2)
               {
                  this.WizardCanComplete = true;
               }
               break;
            case nameof(EntitySelect.IsSelected):
               if (this.SelectedIndex == 0)
               {
                  if (this.Entities.Any(e => e.IsSelected))
                  {
                     this.IsNextEnabled = true;
                     this.NumSelectablePages = 2;
                  } else
                  {
                     this.NumSelectablePages = 1;
                     this.IsNextEnabled = false;
                  }
               }
               break;
            case nameof(this.SelectedEntity):
               if (this.selectedEntity != null)
               {
                  await this.ReadCoreEntityAsync();
                  this.NumSelectablePages = 2;
                  this.IsNextEnabled = true;
               }
               break;
            case nameof(this.Role):
            case nameof(this.RelativePath):
            case nameof(EditRelationshipAttribute.SelectedAttribute):
               foreach (var keyAttributeEdit in this.KeyAttributes)
               {
                  if (keyAttributeEdit.SelectedAttribute == null)
                  {
                     return;
                  }
               }
               this.NumSelectablePages = 3;
               this.IsNextEnabled = true;
               break;

         }
         await Task.Yield();
      }

      private async Task ReadCoreEntityAsync()
      {
         if (this.selectedEntity == null)
         {
            return;
         }

         CoreModelReader coreModelReader = new CoreModelReader();
         var model = await coreModelReader.ReadFromFileAsync(this.selectedEntity.FilePath);
         if (model != null)
         {
            this.KeyCoreModel = model;
            this.KeyAttributes = new ObservableCollection<EditRelationshipAttribute>(
                    this.KeyCoreModel.Entity.Attribute.Where(a => a.BusinessKeyNo != null).
                        Select(a => new EditRelationshipAttribute
                        {
                           KeyAttribute = a ,
                           Attributes = new ObservableCollection<Attribute>(this.CoreEntity.Attribute) ,
                           Filter = a.Name ,
                           OrderNr = a.BusinessKeyNo ?? 0
                        }).
                OrderBy(a => a.OrderNr));

            // set selected fields
            if (this.Relationship != null)
            {
               foreach (var relationshipField in this.Relationship.Fields)
               {
                  var dm8lKeyAttr = new Dm8lAttribute(relationshipField.Dm8lKeyAttr);
                  var keyAttr = this.KeyCoreModel.Entity.Attribute.FirstOrDefault(ra => ra.Name == dm8lKeyAttr.Name);
                  var dm8lAttr = new Dm8lAttribute(relationshipField.Dm8lAttr);
                  var attr = this.CoreEntity.Attribute.FirstOrDefault(ra => ra.Name == dm8lAttr.Name);

                  var existingAttr = this.KeyAttributes.FirstOrDefault(a => a.KeyAttribute == keyAttr);

                  if (existingAttr != null)
                  {
                     existingAttr.SelectedAttribute = attr;
                     existingAttr.Filter = attr?.Name;
                  }
               }
            }

            foreach (var editRelationshipAttribute in this.KeyAttributes)
            {
               editRelationshipAttribute.PropertyChanged += this.DataSourceEditViewModel_PropertyChanged;
            }
         }

      }

      private void OnOK(IClosableWindow window)
      {
         try
         {

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

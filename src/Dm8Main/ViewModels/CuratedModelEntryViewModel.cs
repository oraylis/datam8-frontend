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
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using Dm8Data.AttributeTypes;
using Dm8Data.Core;
using Dm8Data.Helper;
using Dm8Data.Validate;
using Dm8Data.Validate.Exceptions;
using Dm8Locator.Dm8l;
using Dm8Main.Base;
using Dm8Main.Models;
using Dm8Main.Properties;
using Dm8Main.Services;
using Dm8Main.ViewModels.Dialog;
using MvvmDialogs;
using Newtonsoft.Json;
using Prism.Commands;
using Prism.Events;
using Unity;
using Attribute = Dm8Data.Core.Attribute;
using DataType = Dm8Data.DataTypes.DataType;

namespace Dm8Main.ViewModels
{
   [Export]
   public class CuratedModelEntryViewModel:DocumentViewModel<Dm8Data.Curated.ModelEntry>
   {
      #region Property AttributeTypes
      public ObservableCollection<AttributeType> AttributeTypes
      {
         get => this.attributeTypes;
         set => this.SetProperty(ref this.attributeTypes ,value);
      }

      private ObservableCollection<AttributeType> attributeTypes;
      #endregion

      #region Property DataTypes
      public ObservableCollection<DataType> DataTypes
      {
         get => this.dataTypes;
         set => this.SetProperty(ref this.dataTypes ,value);
      }

      private ObservableCollection<DataType> dataTypes;
      #endregion

      #region Property HistoryTypes
      public ObservableCollection<AttributeHistory> HistoryTypes
      {
         get => this.historyTypes;
         set => this.SetProperty(ref this.historyTypes ,value);
      }

      private ObservableCollection<AttributeHistory> historyTypes;
      #endregion

      #region Property UnitAttributes
      public ObservableCollection<Attribute> UnitAttributes
      {
         get => this.unitAttributes;
         set => this.SetProperty(ref this.unitAttributes ,value);
      }

      private ObservableCollection<Attribute> unitAttributes;
      #endregion

      #region Property CoreEntityLocators
      public ObservableCollection<string> CoreEntityLocators
      {
         get => this.coreEntityLocators;
         set => this.SetProperty(ref this.coreEntityLocators ,value);
      }

      private ObservableCollection<string> coreEntityLocators;
      #endregion

      #region Property EditCommand
      public DelegateCommand<object> EditCommand
      {
         get => this.editCommand;
         set => this.SetProperty(ref this.editCommand ,value);
      }

      private DelegateCommand<object> editCommand;
      #endregion

      #region Property AddRawCommand
      public DelegateCommand AddStageCommand
      {
         get => this.addStageCommand;
         set => this.SetProperty(ref this.addStageCommand ,value);
      }

      private DelegateCommand addStageCommand;
      #endregion

      #region Property EditAttributeCommand
      public DelegateCommand<object> EditAttributeCommand
      {
         get => this.editAttributeCommand;
         set => this.SetProperty(ref this.editAttributeCommand ,value);
      }

      private DelegateCommand<object> editAttributeCommand;
      #endregion

      #region Property AddAttributeCommand
      public DelegateCommand AddAttributeCommand
      {
         get => this.addAttributeCommand;
         set => this.SetProperty(ref this.addAttributeCommand ,value);
      }

      private DelegateCommand addAttributeCommand;
      #endregion

      #region Property RemoveAttributeCommand
      public DelegateCommand<object> RemoveAttributeCommand
      {
         get => this.removeAttributeCommand;
         set => this.SetProperty(ref this.removeAttributeCommand ,value);
      }

      private DelegateCommand<object> removeAttributeCommand;
      #endregion

      #region Property SortAttributeCommand
      public DelegateCommand SortAttributeCommand
      {
         get => this.sortAttributeCommand;
         set => this.SetProperty(ref this.sortAttributeCommand ,value);
      }

      private DelegateCommand sortAttributeCommand;
      #endregion

      #region Property AttributeAssignCommand
      public DelegateCommand<AttributeMapping> AttributeAssignCommand
      {
         get => this.attributeAssignCommand;
         set => this.SetProperty(ref this.attributeAssignCommand ,value);
      }

      private DelegateCommand<AttributeMapping> attributeAssignCommand;
      #endregion

      #region Property RelationshipAttrVisibleCommand
      public DelegateCommand<bool?> RelationshipAttrVisibleCommand
      {
         get => this.relationshipAttrVisibleCommand;
         set => this.SetProperty(ref this.relationshipAttrVisibleCommand ,value);
      }

      private DelegateCommand<bool?> relationshipAttrVisibleCommand;
      #endregion

      #region Property RelationshipAttrVisible
      public bool RelationshipAttrVisible
      {
         get => this.relationshipAttrVisible;
         set => this.SetProperty(ref this.relationshipAttrVisible ,value);
      }

      private bool relationshipAttrVisible;
      #endregion

      #region Property EditRelationshipAttributeCommand
      public DelegateCommand<RelationshipAttribute> EditRelationshipAttributeCommand
      {
         get => this.editRelationshipAttributeCommand;
         set => this.SetProperty(ref this.editRelationshipAttributeCommand ,value);
      }

      private DelegateCommand<RelationshipAttribute> editRelationshipAttributeCommand;
      #endregion

      #region Property EditRelationshipCommand
      public DelegateCommand<Relationship> EditRelationshipCommand
      {
         get => this.editRelationshipCommand;
         set => this.SetProperty(ref this.editRelationshipCommand ,value);
      }

      private DelegateCommand<Relationship> editRelationshipCommand;
      #endregion

      #region Property AddRelationshipCommand
      public DelegateCommand AddRelationshipCommand
      {
         get => this.addRelationshipCommand;
         set => this.SetProperty(ref this.addRelationshipCommand ,value);
      }

      private DelegateCommand addRelationshipCommand;
      #endregion

      #region Property RemoveRelationshipCommand
      public DelegateCommand<Relationship> RemoveRelationshipCommand
      {
         get => this.removeRelationshipCommand;
         set => this.SetProperty(ref this.removeRelationshipCommand ,value);
      }

      private DelegateCommand<Relationship> removeRelationshipCommand;
      #endregion

      #region Property VisualizeFunctionCommand
      public DelegateCommand VisualizeFunctionCommand
      {
         get => this.visualizeFunctionCommand;
         set => this.SetProperty(ref this.visualizeFunctionCommand ,value);
      }

      private DelegateCommand visualizeFunctionCommand;
      #endregion

      #region Property VisualizeModelCommand
      public DelegateCommand VisualizeModelCommand
      {
         get => this.visualizeModelCommand;
         set => this.SetProperty(ref this.visualizeModelCommand ,value);
      }

      private DelegateCommand visualizeModelCommand;
      #endregion

      #region Property EditGridCurrentCell
      public DataGridCellInfo? EditGridCurrentCell
      {
         get => this.editGridCurrentCell;
         set
         {
            if (value != null && value.Value.IsValid)
            {
               this.SetProperty(ref this.editGridCurrentCell ,value);
            }
         }
      }

      private DataGridCellInfo? editGridCurrentCell;
      #endregion

      #region Property SelectedRelationship
      public Relationship SelectedRelationship
      {
         get => this.selectedRelationship;
         set => this.SetProperty(ref this.selectedRelationship ,value);
      }

      private Relationship selectedRelationship;
      #endregion

      #region Property Relationships
      public ObservableCollection<Relationship> Relationships
      {
         get => this.relationships;
         set => this.SetProperty(ref this.relationships ,value);
      }

      private ObservableCollection<Relationship> relationships;
      #endregion

      #region Property RelationshipAttribute
      public ObservableCollection<RelationshipAttribute> RelationshipAttributes
      {
         get => this.relationshipAttributes;
         set => this.SetProperty(ref this.relationshipAttributes ,value);
      }

      private ObservableCollection<RelationshipAttribute> relationshipAttributes;
      #endregion

      #region Property VisualSvg
      public string VisualSvg
      {
         get => this.visualSvg;
         set => this.SetProperty(ref this.visualSvg ,value);
      }

      private string visualSvg;
      #endregion

      #region Property EntityName
      public string EntityName
      {
         get => this.entityName;
         set => this.SetProperty(ref this.entityName ,value);
      }

      private string entityName;
      #endregion

      #region Property MermaidString
      public string MermaidString
      {
         get => this.mermaidString;
         set => this.SetProperty(ref this.mermaidString ,value);
      }

      private string mermaidString;
      #endregion

      #region Property Functions
      public ObservableCollection<CuratedFunctionViewModel> Functions
      {
         get => this.functions;
         set => this.SetProperty(ref this.functions ,value);
      }

      private ObservableCollection<CuratedFunctionViewModel> functions;
      #endregion

      #region Property ScaleFactor
      public double ScaleFactor
      {
         get => this.scaleFactor;
         set => this.SetProperty(ref this.scaleFactor ,value);
      }

      private double scaleFactor;
      #endregion


      public CuratedModelEntryViewModel(IUnityContainer unityContainer ,ISolutionService solutionService ,IEventAggregator eventAggregator ,IDialogService dialogService)
          : base(unityContainer ,solutionService ,eventAggregator ,dialogService)
      {
         this.Title = Properties.Resources.Title_RawEntity;
         this.PropertyChanged += this.CoreEntityViewModel_PropertyChanged;

         this.CoreEntityLocators = new ObservableCollection<string>();
         this.Functions = new ObservableCollection<CuratedFunctionViewModel>();

         // initialize commands
         this.EditCommand = new DelegateCommand<object>((p) => EditAction(p));
         this.AddAttributeCommand = new DelegateCommand(async () => await this.AddAttributeAsync());
         this.RemoveAttributeCommand = new DelegateCommand<object>(async (p) => await this.RemoveAttributeAsync(p));
         this.SortAttributeCommand = new DelegateCommand(async () => await this.SortAttributeAsync());
         this.EditAttributeCommand = new DelegateCommand<object>(async (p) => await this.EditAttributeAsync(p));
         this.RelationshipAttrVisibleCommand = new DelegateCommand<bool?>((b) => this.RelationshipAttrVisible = b ?? true);
         this.AddRelationshipCommand = new DelegateCommand(async () => await this.AddRelationshipAsync());
         this.RemoveRelationshipCommand = new DelegateCommand<Relationship>(async (r) => await this.RemoveRelationshipAsync(r));
         this.EditRelationshipAttributeCommand = new DelegateCommand<RelationshipAttribute>(async (ra) => await this.EditRelationshipAttributeAsync(ra));
         this.EditRelationshipCommand = new DelegateCommand<Relationship>(async (ra) => await this.EditRelationshipAsync(ra));
         this.VisualizeModelCommand = new DelegateCommand(async () => await this.VisualizeModelAsync());
         this.VisualizeFunctionCommand = new DelegateCommand(async () => await this.VisualizeFunctionAsync());
         this.RelationshipAttrVisible = false;
         this.ScaleFactor = 1.0;
      }

      private void EditAction(object param)
      {
         if (param is DataGridCellInfo dataGridCellInfo)
         {
            if (dataGridCellInfo.Column.Header.ToString() == Dm8Main.Properties.Resources.CoreModelEntry_Header_Edit)
            {
               this.EditAttributeCommand.Execute(dataGridCellInfo.Item as Attribute);
            }

         }
      }


      private void CoreEntityViewModel_PropertyChanged(object? sender ,PropertyChangedEventArgs e)
      {
         switch (e.PropertyName)
         {
            case nameof(this.Item):
               if (this.Item.Entity != null)
                  this.EntityName = this.Item.Entity.Name;
               break;
         }
      }

      #region Load ViewModel
      protected override async Task LoadInternalAsync()
      {
         // read items
         await base.LoadInternalAsync();
         if (this.IsJsonLoaded)
            await this.LoadInternalMembersAsync();
      }

      public async Task LoadInternalMembersAsync()
      {
         bool updateJson = false;


         this.IsLoading = true;
         try
         {
            var coreEntities = new List<CoreEntity>();
            await Parallel.ForEachAsync(
                this.solutionService.AllProjectItems.
                                    Where(t => t.Type == ProjectItem.Types.CoreEntity || t.Type == ProjectItem.Types.CuratedEntity) ,
                async (t ,c) => coreEntities.Add(await this.solutionService.SolutionHelper.LoadOrGetCoreEntityAsync(t.FilePath))
            );
            this.CoreEntityLocators.Add("");
            this.CoreEntityLocators.AddRange(coreEntities.Where(e => e.Dm8l != this.Item.Entity.Dm8l).Select(e => e.Dm8l));


            // Attribute types
            AttributeTypeModelReader attributeTypeModelReader = new AttributeTypeModelReader();
            var attributeTypes =
                await attributeTypeModelReader.ReadFromFileAsync(this.solution.AttributeTypesFilePath);
            if (this.AttributeTypes == null)
               this.AttributeTypes =
                   new ObservableCollection<Dm8Data.AttributeTypes.AttributeType>(
                       attributeTypes.OrderBy(a => a.Name));
            else
               this.AttributeTypes.Update(attributeTypes ,(i) => i.Name);

            // Read data types
            DataTypeModelReader dataSourceModelReader = new DataTypeModelReader();
            var dataTypes = await dataSourceModelReader.ReadFromFileAsync(this.solution.DataTypesFilePath);
            if (this.DataTypes == null)
               this.DataTypes =
                   new ObservableCollection<Dm8Data.DataTypes.DataType>(dataTypes.OrderBy(d => d.Name));
            else
               this.DataTypes.Update(dataTypes ,(i) => i.Name);

            // relationships
            var relationshipAttrs = this.Item.Entity.Attribute.Where(ma =>
                   this.AttributeTypes.FirstOrDefault(at => at.Name == ma.AttributeType)?.CanBeInRelation ??
                   false);

            this.RelationshipAttributes =
                new ObservableCollection<RelationshipAttribute>(
                    relationshipAttrs.Select(a => new RelationshipAttribute
                    {
                       Attribute = a ,
                       Relationship = this.Item.Entity.Relationship.FirstOrDefault(r =>
                               r.Fields.Any(f => f.Dm8lAttr == new Dm8lAttribute(new Dm8lEntity(this.Item.Entity.Dm8l) ,a.Name).Value))
                    }));
            this.Relationships = new ObservableCollection<Relationship>(this.Item.Entity.Relationship);
            this.HistoryTypes = new ObservableCollection<AttributeHistory>(Enum.GetValues<AttributeHistory>());

            if (updateJson)
            {
               var currentErrorList = new List<ModelReaderException>(this.ErrorList);
               await this.UpdateFromItemAsync();
               this.ErrorList =
                   new ObservableCollection<ModelReaderException>(this.ErrorList.Union(currentErrorList));
            }

            this.Functions.Clear();
            foreach (var function in this.Item.Function)
            {
               this.Functions.Add(new CuratedFunctionViewModel(this ,function ,this.unityContainer ,this.solutionService ,this.eventAggregator ,this.dialogService));
            }
         } catch (Exception ex)
         {
            this.ErrorList.Add(new UnknownValidateException(ex ,this.FilePath));
         }
         finally
         {
            this.IsLoading = false;
         }
      }

      private static void AddNotMappendAttribute(List<AttributeMapping> notMappedAttributes ,Dm8Data.Stage.StageEntity stageEntity ,Dm8Data.Core.Mapping mapping)
      {
         // check if not mapped entry exists -> entry for source name = target name as default
         var mappedEntry = notMappedAttributes.FirstOrDefault(m => m.Attribute?.Name == mapping.SourceName);
         if (mappedEntry == null)
         {
            notMappedAttributes.Add(
                new AttributeMapping
                {
                   Attribute = new Dm8Data.Core.Attribute { Name = mapping.SourceName } ,
                   MappingEntries = new ObservableCollection<MappingEntry>(new MappingEntry[] { new MappingEntry
                        {
                            Name = null,                                   // not mapped
                            SourceName = mapping.SourceName,
                            SourceComputation = mapping.SourceComputation,
                            StageEntity = stageEntity
                        } })
                });
         } else
         {
            mappedEntry.MappingEntries.Add(new MappingEntry
            {
               Name = null ,                                        // not mapped
               SourceName = mapping.SourceName ,
               SourceComputation = mapping.SourceComputation ,
               StageEntity = stageEntity
            });
         }

      }

      private void AddMappendAttribute(List<AttributeMapping> mappedAttributes ,Dm8Data.Stage.StageEntity stageEntity ,Attribute attribute ,Dm8Data.Core.Mapping mapping)
      {
         var mappedEntry = mappedAttributes.FirstOrDefault(m => m.Attribute?.Name == mapping.Name);
         if (mappedEntry == null)
         {
            mappedAttributes.Add(
                new AttributeMapping
                {
                   Attribute = attribute ,
                   MappingEntries = new ObservableCollection<MappingEntry>(new MappingEntry[] { new MappingEntry
                        {
                            Name = attribute.Name,
                            SourceName = mapping.SourceName,
                            SourceComputation = mapping.SourceComputation,
                            StageEntity = stageEntity
                        } })
                });
         } else
         {
            mappedEntry.MappingEntries.Add(new MappingEntry
            {
               Name = mapping.Name ,
               SourceName = mapping.SourceName ,
               SourceComputation = mapping.SourceComputation ,
               StageEntity = stageEntity
            });
         }
      }
      #endregion

      #region Save ViewModel
      protected override async Task SaveInternalAsync()
      {
         if (this.EntityName != this.Item.Entity.Name)
         {
            // entity name was change - change file name + references
            if (await this.RenameEntityAsync())
               return;
         }

         await base.SaveInternalAsync();
      }


      private async Task<bool> RenameEntityAsync()
      {
         // Change entity name
         var renameFile = this.ShowMessageBox(Resources.CoreModelEntryViewModel_EntityOnPropertyChanged_Message ,
             Resources.CoreModelEntryViewModel_EntityOnPropertyChanged_Title ,
             MessageBoxButton.YesNo);

         if (renameFile == MessageBoxResult.Yes)
         {
            try
            {
               var newEntityName = this.Item.Entity.Name;
               var oldEntityName = this.EntityName;

               await this.solutionService.SolutionHelper.RenameEntityAsync(this.FilePath ,oldEntityName ,newEntityName);
               this.ProjectItem.RenameEntity(this.FilePath ,oldEntityName ,newEntityName);
               this.FilePath = this.ProjectItem.FilePath;

               await base.SaveAsync();
               this.EntityName = newEntityName;
               // add refactoring entry
               this.Item.Entity.RefactorNames.Add(oldEntityName);
               return true;
            } catch (Exception ex)
            {
               this.dialogService.ShowException(this ,ex);
            }
         }
         return false;
      }

      #endregion

      #region Edit Attributes
      private async Task AddAttributeAsync()
      {
         var editAttributeViewModel = new DlgCoreAttributeEditViewModel(this.dialogService ,this.solutionService);
         editAttributeViewModel.Attribute = new Attribute();
         editAttributeViewModel.DataTypes = this.DataTypes;
         editAttributeViewModel.UnitAttributes = this.UnitAttributes;
         editAttributeViewModel.AttributeTypes = this.AttributeTypes;
         editAttributeViewModel.HistoryTypes = this.HistoryTypes;
         if ((this.dialogService.ShowDialog(this ,editAttributeViewModel) ?? false))
         {
            this.Item.Entity.Attribute.Add(editAttributeViewModel.Attribute);
            await this.UpdateFromItemAsync();
            await this.LoadInternalMembersAsync();
         }
      }

      private async Task SortAttributeAsync()
      {
         // three groups
         var newAttributeList = new ObservableCollection<Attribute>();

         // first all business keys
         newAttributeList.AddRange(this.Item.Entity.Attribute.
                                     Where(a => a.BusinessKeyNo != null).
                                     OrderBy(a => a.BusinessKeyNo));

         // second all potential relationship fields
         var listAttrsInRel = new List<Attribute>();
         var listAttrsNotInRel = new List<Attribute>();
         foreach (var attribute in this.Item.Entity.Attribute)
         {
            if (attribute.BusinessKeyNo != null)
               continue;

            var attrType = this.AttributeTypes.FirstOrDefault(at => attribute.AttributeType == at.Name);
            if (attrType != null &&
                (attrType.CanBeInRelation ?? false))
            {
               listAttrsInRel.Add(attribute);
            } else
            {
               listAttrsNotInRel.Add(attribute);
            }
         }
         newAttributeList.AddRange(listAttrsInRel.OrderBy(a => a.Name));
         newAttributeList.AddRange(listAttrsNotInRel.OrderBy(a => a.Name));

         this.Item.Entity.Attribute = new ObservableCollection<Attribute>(newAttributeList);

         // can be extended to async calls
         await this.LoadInternalMembersAsync();
      }

      private async Task RemoveAttributeAsync(object attr)
      {
         if (attr == null && this.EditGridCurrentCell != null)
         {
            attr = this.EditGridCurrentCell.Value.Item;
         }
         if (!(attr is Attribute attribute))
            return;

         if (this.Item.Entity.Attribute.Remove(attribute))
         {
            await this.UpdateFromItemAsync();
            await this.LoadInternalMembersAsync();
         }
      }

      private async Task EditAttributeAsync(object attr)
      {
         if (!(attr is Attribute attribute))
            return;

         var attributeJson = JsonConvert.SerializeObject(attribute ,Formatting.Indented ,new Newtonsoft.Json.Converters.StringEnumConverter());
         var oldName = attribute.Name;
         var editAttributeViewModel = new DlgCoreAttributeEditViewModel(this.dialogService ,this.solutionService);
         editAttributeViewModel.Attribute = attribute;
         editAttributeViewModel.DataTypes = this.DataTypes;
         editAttributeViewModel.UnitAttributes = this.UnitAttributes;
         editAttributeViewModel.AttributeTypes = this.AttributeTypes;
         editAttributeViewModel.HistoryTypes = this.HistoryTypes;
         if ((this.dialogService.ShowDialog(this ,editAttributeViewModel) ?? false) == false)
         {
            // Undo changes
            int idx = this.Item.Entity.Attribute.IndexOf(attribute);
            attr = JsonConvert.DeserializeObject<Attribute>(attributeJson) ?? throw new InvalidOperationException();
            this.Item.Entity.Attribute[idx] = attribute;
            await this.UpdateFromItemAsync();
         } else
         {
            // update name (incl. references if changed)
            await this.RenameAttributeAsync(attribute ,oldName);
         }
      }

      private async Task RenameAttributeAsync(Attribute attr ,string oldName)
      {
         // name not change
         if (attr.Name == oldName)
            return;

         // check if reference exists
         var dm8lEntity = new Dm8lEntity(this.Item.Entity.Dm8l);
         var refList = this.solutionService.SolutionHelper.GetReferenced(dm8lEntity).ToList();
         bool oneObjectChanged = false;
         if (refList.Any())
         {
            var checkRefs = this.ShowMessageBox(string.Format(Properties.Resources.CoreModelEntryViewModel_CheckReferences ,this.Item.Entity.Dm8l ,refList.Select((e => e.Value)).ToCommaList()) ,
                Resources.CoreModelEntryViewModel_Update_Referenced_Entities ,MessageBoxButton.YesNo);
            if (checkRefs == MessageBoxResult.Yes)
            {
               oneObjectChanged = await this.solutionService.SolutionHelper.RenameAttributeAsync(dm8lEntity ,oldName ,attr.Name);
            }
         }

         // add refactoring entry
         attr.RefactorNames.Add(oldName);

         // also save this object (ensure referential integrity)
         if (oneObjectChanged)
         {
            await this.SaveAsync();
         }
      }

      #endregion

      #region Realtionship
      private async Task AddRelationshipAsync()
      {
         // Create Relationship
         var viewModel = new DlgCoreEntityEditRelationshipViewModel(this.dialogService ,this.solutionService)
         {
            CoreEntity = this.Item.Entity
         };
         if (this.dialogService.ShowDialog(this ,viewModel) ?? false)
         {
            this.Item.Entity.Relationship.Add(
                new Relationship
                {
                   Dm8lKey = viewModel.KeyCoreModel.Entity.Dm8l ,
                   Role = viewModel.Role ?? "#" ,
                   Fields = new ObservableCollection<RelationshipField>(
                        viewModel.KeyAttributes.Select(a => new RelationshipField
                        {
                           Dm8lKeyAttr = new Dm8lAttribute(viewModel.KeyCoreModel.Entity.Dm8l + "/" + a.KeyAttribute.Name).Value ,
                           Dm8lAttr = a.SelectedAttribute != null ? new Dm8lAttribute(this.Item.Entity.Dm8l + "/" + a.SelectedAttribute.Name).Value : null
                        })
                    )
                });
         }

         await this.LoadInternalMembersAsync();
         this.IsModified = true;
      }

      private async Task RemoveRelationshipAsync(Relationship relationship)
      {
         this.Item.Entity.Relationship.Remove(relationship);

         await this.LoadInternalMembersAsync();
         this.IsModified = true;
      }

      private async Task EditRelationshipAttributeAsync(RelationshipAttribute relationshipAttribute)
      {
         // Create Relationship for selected attribute
         var viewModel = new DlgCoreEntityEditRelationshipViewModel(this.dialogService ,this.solutionService)
         {
            CoreEntity = this.Item.Entity
         };
         if (this.dialogService.ShowDialog(this ,viewModel) ?? false)
         {
            this.Item.Entity.Relationship.Add(
                new Relationship
                {
                   Dm8lKey = viewModel.KeyCoreModel.Entity.Dm8l ,
                   Role = viewModel.Role ?? "#" ,
                   Fields = new ObservableCollection<RelationshipField>(
                        viewModel.KeyAttributes.Select(a => new RelationshipField
                        {
                           Dm8lKeyAttr = new Dm8lAttribute(viewModel.KeyCoreModel.Entity.Dm8l + "/" + a.KeyAttribute.Name).Value ,
                           Dm8lAttr = a.SelectedAttribute != null ? new Dm8lAttribute(this.Item.Entity.Dm8l + "/" + a.SelectedAttribute.Name).Value : null
                        })
                     )
                });
         }

         await Task.Yield();
      }

      private async Task EditRelationshipAsync(Relationship ra)
      {
         // Create Relationship for selected attribute
         var viewModel = new DlgCoreEntityEditRelationshipViewModel(this.dialogService ,this.solutionService)
         {
            CoreEntity = this.Item.Entity ,
            Relationship = ra
         };
         if (this.dialogService.ShowDialog(this ,viewModel) ?? false)
         {
            ra.Dm8lKey = viewModel.KeyCoreModel.Entity.Dm8l;
            ra.Role = viewModel.Role ?? "#";
            ra.Fields = new ObservableCollection<RelationshipField>(
                viewModel.KeyAttributes.Select(a => new RelationshipField
                {
                   Dm8lKeyAttr = viewModel.KeyCoreModel.Entity.Dm8l + "/" + a.KeyAttribute.Name ,
                   Dm8lAttr = a.SelectedAttribute != null
                        ? this.Item.Entity.Dm8l + "/" + a.SelectedAttribute.Name
                        : null
                })
            );
         }

         await Task.Yield();
      }


      #endregion

      #region Visualize
      private async Task VisualizeModelAsync()
      {
         try
         {
            MermaidHelper mermaidHelper = new MermaidHelper();
            StringBuilder mermaid = new StringBuilder();
            mermaid.Append(mermaidHelper.PrintInit());
            mermaid.Append(mermaidHelper.PrintEntity(this.Item.Entity));

            if (!string.IsNullOrEmpty(this.Item.Entity.ExtensionOf))
            {
               var extEntity = await this.solutionService.SolutionHelper.LoadOrGetCoreEntityAsync(
                   new Dm8lEntity(this.Item.Entity.ExtensionOf));
               mermaid.Append(mermaidHelper.PrintEntity(extEntity));
               mermaid.Append(mermaidHelper.PrintIsA(this.Item.Entity));
            }

            // select all relationships
            foreach (var relationship in this.Item.Entity.Relationship)
            {
               var relEntity = await this.solutionService.SolutionHelper.LoadOrGetCoreEntityAsync(
                   new Dm8lEntity(relationship.Dm8lKey));
               mermaid.Append(mermaidHelper.PrintEntity(relEntity));
            }

            // print all realtionships (also between)
            mermaid.Append(mermaidHelper.PrintAllRelationship());

            this.MermaidString = mermaid.ToString();
            await this.RenderMermaidAsync();
         } catch (Exception ex)
         {
            this.dialogService.ShowException(this ,ex);
         }
      }

      private async Task VisualizeFunctionAsync()
      {
         try
         {
            MermaidHelper mermaidHelper = new MermaidHelper(MermaidHelper.GraphType.ClassDiagram);
            StringBuilder mermaid = new StringBuilder();
            mermaid.Append(mermaidHelper.PrintInit());
            mermaid.Append(mermaidHelper.PrintEntity(this.Item.Entity));

            foreach (var function in this.Item.Function)
            {
               mermaid.Append(mermaidHelper.PrintFunction(this.Item.Entity ,function));
               foreach (var functionSource in function.Source)
               {
                  var sourceEntity = await this.solutionService.SolutionHelper.LoadOrGetCoreEntityAsync(
                      new Dm8lEntity(functionSource.Dm8l));
                  mermaid.Append(mermaidHelper.PrintEntity(sourceEntity));
               }
            }

            mermaid.Append(mermaidHelper.PrintAllRelationship());
            this.MermaidString = mermaid.ToString();
            await this.RenderMermaidAsync();

         } catch (Exception ex)
         {
            this.dialogService.ShowException(this ,ex);
         }
      }

      private async Task RenderMermaidAsync()
      {
         var exeFileName = "cmd.exe";
         var pathDirs = Environment.GetEnvironmentVariable("PATH").Split(';');
         var exeFileNameFullPath = (string)null;
         foreach (string dir in pathDirs)
         {
            string fullPath = Path.Combine(dir ,exeFileName);
            if (File.Exists(fullPath))
            {
               exeFileNameFullPath = fullPath;
               break;
            }
         }

         if (exeFileNameFullPath == null)
            return;

         var inFile = Path.GetTempFileName();
         var outFile = Path.GetTempFileName().Replace(".tmp" ,".png");
         var args = $"/c mmdc -i {inFile} -o {outFile} -e png -s 3";
         if (this.solutionService.Theme == ColorTheme.Dark)
         {
            args += " -b 252526";
         } else
         {
            args += " -b F5F5F5";
         }
         File.WriteAllText(inFile ,this.MermaidString);
         await ProcessExt.RunAsync(exeFileNameFullPath ,args ,
             (s) => this.eventAggregator.GetEvent<OutputLineEvent>().Publish(new KeyValuePair<string ,string>("Mermaid" ,s)) ,
             (s) => this.eventAggregator.GetEvent<OutputLineEvent>().Publish(new KeyValuePair<string ,string>("Mermaid" ,"Error: " + s))
         );
         var size = PngHelper.GetDimensions(outFile);
         var cropedFile = PngHelper.Crop(outFile ,(int)(size.Width * 0.98) ,(int)(size.Height * 0.98));

         this.VisualSvg = cropedFile;
      }

      #endregion
   }
}

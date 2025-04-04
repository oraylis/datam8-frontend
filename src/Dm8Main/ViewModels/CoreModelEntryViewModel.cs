using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Composition;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using Dm8Data.AttributeTypes;
using Dm8Data.Core;
using Dm8Data.Helper;
using Dm8Data.Stage;
using Dm8Data.Validate;
using Dm8Data.Validate.Exceptions;
using Dm8Locator.Dm8l;
using Dm8Main.Base;
using Dm8Main.Models;
using Dm8Main.Properties;
using Dm8Main.Services;
using Dm8Main.Updates;
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
#pragma warning disable CS0252 // Possible unintended reference comparison; left hand side needs cast

    [Export]
    public class CoreModelEntryViewModel : DocumentViewModel<Dm8Data.Core.ModelEntry>
    {
        #region Property SelectedIndex
        public int SelectedIndex
        {
            get => this.selectedIndex;
            set => this.SetProperty(ref this.selectedIndex, value);
        }

        private int selectedIndex;
        #endregion

        #region Property AttributeTypes
        public ObservableCollection<AttributeType> AttributeTypes
        {
            get => this.attributeTypes;
            set => this.SetProperty(ref this.attributeTypes, value);
        }

        private ObservableCollection<AttributeType> attributeTypes;
        #endregion

        #region Property HistoryTypes
        public ObservableCollection<AttributeHistory> HistoryTypes
        {
            get => this.historyTypes;
            set => this.SetProperty(ref this.historyTypes, value);
        }

        private ObservableCollection<AttributeHistory> historyTypes;
        #endregion

        #region Property DataTypes
        public ObservableCollection<DataType> DataTypes
        {
            get => this.dataTypes;
            set => this.SetProperty(ref this.dataTypes, value);
        }

        private ObservableCollection<DataType> dataTypes;
        #endregion

        #region Property UnitAttributes
        public ObservableCollection<Attribute> UnitAttributes
        {
            get => this.unitAttributes;
            set => this.SetProperty(ref this.unitAttributes, value);
        }

        private ObservableCollection<Attribute> unitAttributes;
        #endregion
        
        #region Property StageEntries
        public ObservableCollection<SourceMapping> StageEntries
        {
            get => this.stageEntries;
            set => this.SetProperty(ref this.stageEntries, value);
        }

        private ObservableCollection<SourceMapping> stageEntries;
        #endregion

        #region Property SelectedStageEntry
        public SourceMapping SelectedStageEntry
        {
            get => this.selectedStageEntry;
            set => this.SetProperty(ref this.selectedStageEntry, value);
        }

        private SourceMapping selectedStageEntry;
        #endregion
        
        #region Property NotMappedAttributes
        public ObservableCollection<AttributeMapping> NotMappedAttributes
        {
            get => this.notMappedAttributes;
            set => this.SetProperty(ref this.notMappedAttributes, value);
        }

        private ObservableCollection<AttributeMapping> notMappedAttributes;
        #endregion

        #region Property MappedAttributes
        public ObservableCollection<AttributeMapping> MappedAttributes
        {
            get => this.mappedAttributes;
            set => this.SetProperty(ref this.mappedAttributes, value);
        }

        private ObservableCollection<AttributeMapping> mappedAttributes;
        #endregion

        #region Property SelectedComputeItem
        public AttributeMapping SelectedComputeItem
        {
            get => this.selectedComputeItem;
            set => this.SetProperty(ref this.selectedComputeItem, value);
        }

        private AttributeMapping selectedComputeItem;
        private AttributeMapping oldSelectedComputeItem;
        #endregion

        #region Property SelectedComputeValue
        public string SelectedComputeValue
        {
            get => this.selectedComputeValue;
            set => this.SetProperty(ref this.selectedComputeValue, value);
        }

        private string selectedComputeValue;
        #endregion

        #region Property EditCommand
        public DelegateCommand<object> EditCommand
        {
            get => this.editCommand;
            set => this.SetProperty(ref this.editCommand, value);
        }

        private DelegateCommand<object> editCommand;
        #endregion

        #region Property AddRawCommand
        public DelegateCommand AddStageCommand
        {
            get => this.addStageCommand;
            set => this.SetProperty(ref this.addStageCommand, value);
        }

        private DelegateCommand addStageCommand;
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

        #region Property AddSourceAttributesCommand
        public DelegateCommand AddSourceAttributesCommand
        {
            get => this.addSourceAttributesCommand;
            set => this.SetProperty(ref this.addSourceAttributesCommand, value);
        }

        private DelegateCommand addSourceAttributesCommand;
        #endregion

        #region Property EditAttributeCommand
        public DelegateCommand<AttributeMapping> EditAttributeCommand
        {
            get => this.editAttributeCommand;
            set => this.SetProperty(ref this.editAttributeCommand, value);
        }

        private DelegateCommand<AttributeMapping> editAttributeCommand;
        #endregion

        #region Property AddAttributeCommand
        public DelegateCommand AddAttributeCommand
        {
            get => this.addAttributeCommand;
            set => this.SetProperty(ref this.addAttributeCommand, value);
        }

        private DelegateCommand addAttributeCommand;
        #endregion

        #region Property RemoveAttributeCommand
        public DelegateCommand<AttributeMapping> RemoveAttributeCommand
        {
            get => this.removeAttributeCommand;
            set => this.SetProperty(ref this.removeAttributeCommand, value);
        }

        private DelegateCommand<AttributeMapping> removeAttributeCommand;
        #endregion

        #region Property SortAttributeCommand
        public DelegateCommand SortAttributeCommand
        {
            get => this.sortAttributeCommand;
            set => this.SetProperty(ref this.sortAttributeCommand, value);
        }

        private DelegateCommand sortAttributeCommand;
        #endregion

        #region Property AttributeAssignCommand
        public DelegateCommand<AttributeMapping> AttributeAssignCommand
        {
            get => this.attributeAssignCommand;
            set => this.SetProperty(ref this.attributeAssignCommand, value);
        }

        private DelegateCommand<AttributeMapping> attributeAssignCommand;
        #endregion

        #region Property RemoveSourceAttributesCommand
        public DelegateCommand RemoveSourceAttributesCommand
        {
            get => this.removeSourceAttributesCommand;
            set => this.SetProperty(ref this.removeSourceAttributesCommand, value);
        }

        private DelegateCommand removeSourceAttributesCommand;
        #endregion

        #region Property RelationshipAttrVisibleCommand
        public DelegateCommand<bool?> RelationshipAttrVisibleCommand
        {
            get => this.relationshipAttrVisibleCommand;
            set => this.SetProperty(ref this.relationshipAttrVisibleCommand, value);
        }

        private DelegateCommand<bool?> relationshipAttrVisibleCommand;
        #endregion

        #region Property RelationshipAttrVisible
        public bool RelationshipAttrVisible
        {
            get => this.relationshipAttrVisible;
            set => this.SetProperty(ref this.relationshipAttrVisible, value);
        }

        private bool relationshipAttrVisible;
        #endregion

        #region Property EditRelationshipAttributeCommand
        public DelegateCommand<RelationshipAttribute> EditRelationshipAttributeCommand
        {
            get => this.editRelationshipAttributeCommand;
            set => this.SetProperty(ref this.editRelationshipAttributeCommand, value);
        }

        private DelegateCommand<RelationshipAttribute> editRelationshipAttributeCommand;
        #endregion

        #region Property EditRelationshipCommand
        public DelegateCommand<Relationship> EditRelationshipCommand
        {
            get => this.editRelationshipCommand;
            set => this.SetProperty(ref this.editRelationshipCommand, value);
        }

        private DelegateCommand<Relationship> editRelationshipCommand;
        #endregion

        #region Property AddRelationshipCommand
        public DelegateCommand AddRelationshipCommand
        {
            get => this.addRelationshipCommand;
            set => this.SetProperty(ref this.addRelationshipCommand, value);
        }

        private DelegateCommand addRelationshipCommand;
        #endregion

        #region Property RemoveRelationshipCommand
        public DelegateCommand<Relationship> RemoveRelationshipCommand
        {
            get => this.removeRelationshipCommand;
            set => this.SetProperty(ref this.removeRelationshipCommand, value);
        }

        private DelegateCommand<Relationship> removeRelationshipCommand;
        #endregion

        #region Property EditGridCurrentCell
        public DataGridCellInfo? EditGridCurrentCell
        {
            get => this.editGridCurrentCell;
            set
            {
                if (value != null && value.Value.IsValid)
                {
                    this.SetProperty(ref this.editGridCurrentCell, value);
                }
            }
        }

        private DataGridCellInfo? editGridCurrentCell;
        #endregion    

        #region Property SelectedRelationship
        public Relationship SelectedRelationship
        {
            get => this.selectedRelationship;
            set => this.SetProperty(ref this.selectedRelationship, value);
        }

        private Relationship selectedRelationship;
        #endregion

        #region Property Relationships
        public ObservableCollection<Relationship> Relationships
        {
            get => this.relationships;
            set => this.SetProperty(ref this.relationships, value);
        }

        private ObservableCollection<Relationship> relationships;
        #endregion

        #region Property RelationshipAttribute
        public ObservableCollection<RelationshipAttribute> RelationshipAttributes
        {
            get => this.relationshipAttributes;
            set => this.SetProperty(ref this.relationshipAttributes, value);
        }

        private ObservableCollection<RelationshipAttribute> relationshipAttributes;
        #endregion

        #region Property FilterComputeValue
        public string FilterComputeValue

        {
            get => this.filterComputeValue;
            set => this.SetProperty(ref this.filterComputeValue, value);
        }

        private string filterComputeValue;
        #endregion

        #region Property EntityName
        public string EntityName
        {
            get => this.entityName;
            set => this.SetProperty(ref this.entityName, value);
        }

        private string entityName;
        #endregion


        public CoreModelEntryViewModel(IUnityContainer unityContainer, ISolutionService solutionService, IEventAggregator eventAggregator, IDialogService dialogService)
            : base(unityContainer, solutionService, eventAggregator, dialogService)
        {
            this.Title = Properties.Resources.Title_RawEntity;
            this.PropertyChanged += this.CoreEntityViewModel_PropertyChanged;

            this.StageEntries = new ObservableCollection<SourceMapping>();
            this.MappedAttributes = new ObservableCollection<AttributeMapping>();
            this.NotMappedAttributes = new ObservableCollection<AttributeMapping>();

            // initialize commands
            this.EditCommand = new DelegateCommand<object>((p) => EditAction(p));
            this.AddSourceAttributesCommand = new DelegateCommand(AddSourceAttributes);
            this.RemoveSourceAttributesCommand = new DelegateCommand(RemoveSourceAttributes);

            this.AddAttributeCommand = new DelegateCommand(async () => await this.AddAttributeAsync());
            this.RemoveAttributeCommand = new DelegateCommand<AttributeMapping>(async (p) => await this.RemoveAttributeAsync(p));
            this.SortAttributeCommand = new DelegateCommand(async () => await this.SortAttributeAsync());
            this.EditAttributeCommand = new DelegateCommand<AttributeMapping>(async (p) => await this.EditAttributeAsync(p));
            this.AttributeAssignCommand = new DelegateCommand<AttributeMapping>(async (p) => await this.AttributeAssignAsync(p));
            this.RelationshipAttrVisibleCommand = new DelegateCommand<bool?>((b) => this.RelationshipAttrVisible = b ?? true);
            this.AddRelationshipCommand = new DelegateCommand(async () => await this.AddRelationshipAsync());
            this.RemoveRelationshipCommand = new DelegateCommand<Relationship>(async (r) => await this.RemoveRelationshipAsync(r));
            this.EditRelationshipAttributeCommand = new DelegateCommand<RelationshipAttribute>(async (ra) => await this.EditRelationshipAttributeAsync(ra));
            this.EditRelationshipCommand = new DelegateCommand<Relationship>(async (ra) => await this.EditRelationshipAsync(ra));
            this.RelationshipAttrVisible = false;
        }

        private void EditAction(object param)
        {
            if (param is DataGridCellInfo dataGridCellInfo)
            {
                if (dataGridCellInfo.Column?.Header?.ToString() == Dm8Main.Properties.Resources.CoreModelEntry_Header_Assign)
                {
                    this.AttributeAssignCommand.Execute(dataGridCellInfo.Item as AttributeMapping);
                }
                if (dataGridCellInfo.Column?.Header?.ToString() == Dm8Main.Properties.Resources.CoreModelEntry_Header_Edit)
                {
                    this.EditAttributeCommand.Execute(dataGridCellInfo.Item as AttributeMapping);
                }
                
            }
        }


        private void CoreEntityViewModel_PropertyChanged(object? sender, PropertyChangedEventArgs e)
        {
            switch (e.PropertyName)
            {
                case nameof(this.Item):
                    if (this.Item.Entity != null)
                        this.EntityName = this.Item.Entity.Name;
                    break;

                case nameof(this.SelectedComputeValue):
                case nameof(this.SelectedComputeItem):
                    if (this.oldSelectedComputeItem != null)
                    {
                        var oldCompEntry = this.oldSelectedComputeItem.MappingEntries.FirstOrDefault(me => me.StageEntity.Name == "#");
                        if (oldCompEntry != null)
                        {
                            if (oldSelectedComputeItem.Compute != this.SelectedComputeValue)
                            {
                                var funcEntry = this.Item.Function.Source.
                                    Where(s => s.Dm8l == "#").
                                    SelectMany(s => s.Mapping).
                                    FirstOrDefault(m => m.SourceName == oldCompEntry.SourceName);
                                if (funcEntry != null)
                                {
                                    funcEntry.SourceComputation = this.SelectedComputeValue;
                                }
                            }
                            oldCompEntry.SourceComputation = this.SelectedComputeValue;
                            oldSelectedComputeItem.Compute = this.SelectedComputeValue;
                        }
                    }
                    if (this.SelectedComputeItem != null)
                    {
                        this.oldSelectedComputeItem = this.SelectedComputeItem;
                        var compEntry = this.SelectedComputeItem.MappingEntries.FirstOrDefault(me => me.StageEntity.Name == "#");
                        if (compEntry != null)
                        {
                            this.SelectedComputeValue = compEntry.SourceComputation;
                        }
                    }
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

            // clear lists
            var notMappedAttributes = new List<AttributeMapping>();
            var mappedAttributes = new List<AttributeMapping>();
            var stageEntries = new ObservableCollection<SourceMapping>();

            this.IsLoading = true;
            try
            {
                // Attribute types
                AttributeTypeModelReader attributeTypeModelReader = new AttributeTypeModelReader();
                var attributeTypes = await attributeTypeModelReader.ReadFromFileAsync(this.solution.AttributeTypesFilePath);

                var check = new ObservableCollection<Dm8Data.AttributeTypes.AttributeType>(
                    attributeTypes.OrderBy(a => a.Name));

                bool found = true;
                check = CheckDefaultEntries.AttributTypes(check, out found);
                if (!found)
                {
                    var json = JsonConvert.SerializeObject(check, Formatting.Indented, new Newtonsoft.Json.Converters.StringEnumConverter());
                    json = "{\"items\": " + json + "}";
                    await FileHelper.WriteFileAsync(this.solution.AttributeTypesFilePath, json);
                    attributeTypes = await attributeTypeModelReader.ReadFromFileAsync(this.solution.AttributeTypesFilePath);
                }


                if (this.AttributeTypes == null)
                {
                    this.AttributeTypes =
                        new ObservableCollection<Dm8Data.AttributeTypes.AttributeType>(
                            attributeTypes.OrderBy(a => a.Name));
                }
                else
                {
                    this.AttributeTypes.Update(attributeTypes, (i) => i.Name);
                }

                // Read data types
                DataTypeModelReader dataSourceModelReader = new DataTypeModelReader();
                var dataTypes = await dataSourceModelReader.ReadFromFileAsync(this.solution.DataTypesFilePath);
                if (this.DataTypes == null)
                    this.DataTypes =
                        new ObservableCollection<Dm8Data.DataTypes.DataType>(dataTypes.OrderBy(d => d.Name));
                else
                    this.DataTypes.Update(dataTypes, (i) => i.Name);

                // create mapping for each attribute
                var src = this.Item.Function.Source.FirstOrDefault(src => src.Dm8l == "#");
                if (src == null)
                {
                    src = new SourceEntity
                    {
                        Dm8l = "#"
                    };
                    this.Item.Function.Source.Insert(0, src);

                    // default mapping entry does not exist 
                    updateJson = true;
                }

                // create default entry for each attribute
                foreach (var attr in this.Item.Entity.Attribute)
                {
                    //    
                    if (!src.Mapping.Any(m => m.Name == attr.Name))
                    {
                        src.Mapping.Add(new Mapping
                        {
                            Name = attr.Name,
                            SourceName = attr.Name,
                            SourceComputation = "Default"
                        });
                        updateJson = true;
                        this.eventAggregator.GetEvent<OutputLineEvent>()
                            .Publish(new KeyValuePair<string, string>(Properties.Resources.OutputViewModel_Generate,
                                string.Format("{0}: Added default mapping for attribute '{1}'", this.Item.Entity.Dm8l,
                                    attr.Name)));
                    }
                }

                // read source items and create mapping
                foreach (var sourceEntity in this.Item.Function.Source)
                {
                    // default entry for columns not coming from any source
                    Dm8Data.Stage.StageEntity stageEntity = null;
                    if (sourceEntity.Dm8l == "#")
                    {
                        // dummy stage object
                        stageEntity = new StageEntity { Name = "#" };
                    }
                    else
                    {
                        var fileName = this.solutionService.SolutionHelper.GetFileName(sourceEntity.Dm8l);
                        if (fileName == null)
                        { 
                            // entity error already reported by validation function
                            continue;
                        }

                        StageModelReader stageReader = new StageModelReader();
                        var stageEntry = await stageReader.ReadFromFileAsync(fileName);

                        stageEntries.Add(new SourceMapping { StageModel = stageEntry, SourceEntity = sourceEntity });
                        stageEntity = stageEntry.Entity;

                        // check for new/missing attributes
                        var notMappedSourceAttriubtes =
                            stageEntry.Entity.Attribute.Where(a =>
                                !sourceEntity.Mapping.Any(m => a.Name == m.SourceName));

                        sourceEntity.Mapping.AddRange(notMappedSourceAttriubtes.Select(sa =>
                            new Mapping { SourceName = sa.Name, SourceComputation = null }));
                    }

                    // check mapping
                    var wrongMappings = new List<Mapping>();
                    foreach (var m in sourceEntity.Mapping)
                    {
                        if (m.Name != null)
                        {
                            var attr = this.Item.Entity.Attribute.FirstOrDefault(a => a.Name == m.Name);
                            if (attr != null)
                            {
                                this.AddMappendAttribute(mappedAttributes, stageEntity, attr, m);
                            }
                            else
                            {
                                // mapping for not existing attribute
                                wrongMappings.Add(m);
                            }
                        }
                        else
                        {
                            AddNotMappendAttribute(notMappedAttributes, stageEntity, m);
                        }
                    }

                    foreach (var mapping in wrongMappings)
                    {
                        this.eventAggregator.GetEvent<OutputLineEvent>()
                            .Publish(new KeyValuePair<string, string>(Properties.Resources.OutputViewModel_Generate,
                                string.Format(
                                    "{0}: Removed mapping to unknown source attribute '{1}' from source entity '{2}'",
                                    this.Item.Entity.Dm8l, mapping.Name, sourceEntity.Dm8l)));
                        sourceEntity.Mapping.Remove(mapping);
                    }
                }

                var unitList = mappedAttributes
                    .Join(this.AttributeTypes, m => m.Attribute.AttributeType, at => at.Name,
                        (am, at) => new { attribute = am.Attribute, attributeType = at }).Where(e =>
                        e.attributeType.IsUnit != AttributeTypeIsUnit.NoUnit && e.attributeType.IsUnit != null)
                    .Select(e => e.attribute)
                    .OrderBy(u => u.Name)
                    .ToList();
                unitList.Add(new Attribute { Name = "" });

                var relationshipAttrs = mappedAttributes.Where(ma =>
                    this.AttributeTypes.FirstOrDefault(at => at.Name == ma.Attribute.AttributeType)?.CanBeInRelation ??
                    false);

                Dictionary<Attribute, int> attrIndex = new Dictionary<Attribute, int>();
                for (int i = 0; i<this.Item.Entity.Attribute.Count; i++)
                {
                    attrIndex.Add(this.Item.Entity.Attribute[i], i);
                }

                this.UnitAttributes = new ObservableCollection<Attribute>(unitList.OrderBy(o => o.Name));
                this.MappedAttributes = new ObservableCollection<AttributeMapping>(
                                                mappedAttributes.OrderBy(
                                                    ma => attrIndex[ma.Attribute]));
                this.NotMappedAttributes = new ObservableCollection<AttributeMapping>(
                                                notMappedAttributes.OrderBy(
                                                    ma => ma.Attribute.Name));
                this.StageEntries = stageEntries;
                this.RelationshipAttributes =
                    new ObservableCollection<RelationshipAttribute>(
                        relationshipAttrs.Select(a => new RelationshipAttribute
                        {
                            Attribute = a.Attribute,
                            Relationship = this.Item.Entity.Relationship.FirstOrDefault(r =>
                                r.Fields.Any(f => f.Dm8lAttr == new Dm8lAttribute(new Dm8lEntity(this.Item.Entity.Dm8l), a.Attribute.Name).Value))
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
            }
            catch (Exception ex)
            {
                this.NotMappedAttributes.Clear();
                this.MappedAttributes.Clear();
                this.StageEntries.Clear();

                this.ErrorList.Add(new UnknownValidateException(ex, this.FilePath));
            }
            finally
            {
                this.IsLoading = false;
            }
        }

        private static void AddNotMappendAttribute(List<AttributeMapping> notMappedAttributes, Dm8Data.Stage.StageEntity stageEntity, Dm8Data.Core.Mapping mapping)
        {
            // check if not mapped entry exists -> entry for source name = target name as default
            var mappedEntry = notMappedAttributes.FirstOrDefault(m => m.Attribute?.Name == mapping.SourceName);    
            if (mappedEntry == null)
            {
                notMappedAttributes.Add(
                    new AttributeMapping { 
                        Attribute = new Dm8Data.Core.Attribute { Name = mapping.SourceName },
                        MappingEntries = new ObservableCollection<MappingEntry>(new MappingEntry[] { new MappingEntry
                        {
                            Name = null,                                   // not mapped
                            SourceName = mapping.SourceName,
                            SourceComputation = mapping.SourceComputation,
                            StageEntity = stageEntity
                        } }) 
                    });
            }
            else
            {
                mappedEntry.MappingEntries.Add(new MappingEntry
                {
                    Name = null,                                        // not mapped
                    SourceName = mapping.SourceName,
                    SourceComputation = mapping.SourceComputation,
                    StageEntity = stageEntity
                });
            }

        }

        private void AddMappendAttribute(List<AttributeMapping> mappedAttributes, Dm8Data.Stage.StageEntity stageEntity, Attribute attribute, Dm8Data.Core.Mapping mapping)
        {
            var mappedEntry = mappedAttributes.FirstOrDefault(m => m.Attribute?.Name == mapping.Name);    
            if (mappedEntry == null)
            {
                mappedAttributes.Add(
                    new AttributeMapping
                    {
                        Attribute = attribute,
                        MappingEntries = new ObservableCollection<MappingEntry>(new MappingEntry[] { new MappingEntry
                        {
                            Name = attribute.Name,
                            SourceName = mapping.SourceName,
                            SourceComputation = mapping.SourceComputation,
                            StageEntity = stageEntity
                        } })
                    });
            }
            else
            {
                mappedEntry.MappingEntries.Add(new MappingEntry
                {
                    Name = mapping.Name, 
                    SourceName = mapping.SourceName,
                    SourceComputation = mapping.SourceComputation,
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
            var renameFile = this.ShowMessageBox(Resources.CoreModelEntryViewModel_EntityOnPropertyChanged_Message,
                Resources.CoreModelEntryViewModel_EntityOnPropertyChanged_Title,
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
                    // add refactoring entry    
                    this.Item.Entity.RefactorNames.Add(oldEntityName);
                    return true;
                }
                catch (Exception ex)
                {
                    this.dialogService.ShowException(this, ex);
                }
            }
            return false;
        }

        #endregion

        #region Select Source Attributes
        private void AddSourceAttributes()
        {
            foreach (var attribute in this.NotMappedAttributes.Where(m => m.IsChecked).ToList())
            {
                this.NotMappedAttributes.Remove(attribute);
                this.MappedAttributes.Add(attribute);

                // set mapping entry in entities
                foreach (var me in attribute.MappingEntries)
                {
                    // not a source mapping (default mappings cannot be added) -> happens if attribute is removed and added again
                    if (me.StageEntity.Name == "#")
                        continue;

                    me.Name = attribute.Attribute.Name; // copy name
                    var attr = this.CreateAttributeIfNotExists(me); // create real attribute
                    attribute.Attribute = attr;
                    foreach (var mapEntity in this.Item.Function.Source.SelectMany(s => s.Mapping).Where(m => m.SourceName == me.SourceName))
                    {
                        mapEntity.Name = attr.Name;
                    }

                }
            }
        }

        private Dm8Data.Core.Attribute CreateAttributeIfNotExists(MappingEntry me)
        {
            // target attribute name does not exist
            var attr = this.Item.Entity.Attribute.FirstOrDefault(attr => attr.Name == me.Name);
            if (attr == null)
            {
                // add Attribute
                var stageAttr = me.StageEntity.Attribute.FirstOrDefault(attr => attr.Name == me.Name);
                if (stageAttr == null)
                {
                    throw new ModelReaderException($"Mapped source attribute '{me.SourceName}' does not exist in '{me.StageEntity.Name}'");
                }

                attr = new Dm8Data.Core.Attribute
                {
                    Name = me.Name,
                    DisplayName = stageAttr.Name,
                    DataType = stageAttr.Type,
                    CharLength = stageAttr.CharLength,
                    CharSet = stageAttr.CharSet,
                    Nullable = stageAttr.Nullable,
                    Precision = stageAttr.Precision,
                    Scale = stageAttr.Scale,
                    AttributeType = getDefaultTypeForDataType(stageAttr.Type),
                    UnitAttribute = stageAttr.UnitName,
                    Tags = stageAttr.Tags
                };
                this.Item.Entity.Attribute.Add(attr);
            }

            return attr;
        }

        private void RemoveSourceAttributes()
        {
            foreach (var attribute in this.MappedAttributes.Where(m => m.IsChecked).ToList())
            {
                this.MappedAttributes.Remove(attribute);
                this.NotMappedAttributes.Add(attribute);

                // Remove attribute itself from entity
                var attributeToRemove = this.Item.Entity.Attribute.Where(a => a.Name == attribute.Attribute.Name).First();
                this.Item.Entity.Attribute.Remove(attributeToRemove);

                // Remove mapping from sources
                foreach (var source in this.Item.Function.Source)
                {
                    var mappingToRemove = source.Mapping.Where(m => m.Name == attribute.Attribute.Name).FirstOrDefault();

                    // if no mapping found continue to next iteration
                    if (mappingToRemove == default)
                        continue;

                    if (source.Dm8l == "#")
                        source.Mapping.Remove(mappingToRemove);
                    else
                        mappingToRemove.Name = null;
                }
            }
        }
        #endregion

        #region Edit Attributes
        private async Task AddAttributeAsync()
        {
            var editAttributeViewModel = new DlgCoreAttributeEditViewModel(this.dialogService, this.solutionService);
            editAttributeViewModel.Attribute = new Attribute();
            editAttributeViewModel.DataTypes = this.DataTypes;
            editAttributeViewModel.UnitAttributes = this.UnitAttributes;
            editAttributeViewModel.AttributeTypes = this.AttributeTypes;
            editAttributeViewModel.HistoryTypes = this.HistoryTypes;
            if ((this.dialogService.ShowDialog(this, editAttributeViewModel) ?? false))
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
                }
                else
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

        private async Task RemoveAttributeAsync(AttributeMapping obj)
        {
            if (obj == null && this.EditGridCurrentCell != null)
            {
                obj = this.EditGridCurrentCell.Value.Item as AttributeMapping;
            }
            if (obj == null)
                return;

            if (this.Item.Entity.Attribute.Remove(obj.Attribute))
            {
                await this.UpdateFromItemAsync();
                await this.LoadInternalMembersAsync();
            }
        }

        private async Task EditAttributeAsync(AttributeMapping obj)
        {
            var attributeJson = FileHelper.MakeJson(obj.Attribute);
            var oldName = obj.Attribute.Name;
            var editAttributeViewModel = new DlgCoreAttributeEditViewModel(this.dialogService, this.solutionService);
            editAttributeViewModel.Attribute = obj.Attribute;
            editAttributeViewModel.DataTypes = this.DataTypes;
            editAttributeViewModel.UnitAttributes = this.UnitAttributes;
            editAttributeViewModel.AttributeTypes = this.AttributeTypes;
            editAttributeViewModel.HistoryTypes = this.HistoryTypes;
            if ((this.dialogService.ShowDialog(this, editAttributeViewModel) ?? false) == false)
            {
                // Undo changes
                int idx = this.Item.Entity.Attribute.IndexOf(obj.Attribute);
                obj.Attribute = JsonConvert.DeserializeObject<Attribute>(attributeJson) ?? throw new InvalidOperationException();
                this.Item.Entity.Attribute[idx] = obj.Attribute;
                await this.UpdateFromItemAsync();
            }
            else
            {
                // apply name change
                foreach (var m in obj.MappingEntries)
                {
                    m.Name = obj.Attribute.Name;
                }

                foreach (var src in this.Item.Function.Source)
                {
                    foreach (var map in src.Mapping)
                    {
                        if (map.Name == oldName)
                            map.Name = obj.Attribute.Name;
                    }
                }

                // update name (incl. references if changed)
                await this.RenameAttributeAsync(obj.Attribute, oldName);
            }
        }

        private async Task AttributeAssignAsync(AttributeMapping obj)
        {
            var editAttributeViewModel = new DlgCoreAttributeAssignViewModel(this.dialogService, this.solutionService)
                {
                    Attribute = obj.Attribute,
                    AttributeMapping = new ObservableCollection<CheckableContent<MappingEntry>>(obj.MappingEntries.Where(s => s.StageEntity.Name != "#").Select(ma => new CheckableContent<MappingEntry>(ma))),
                    AttributeAll = new ObservableCollection<CheckableContent<MappingEntry>>(
                        this.MappedAttributes.SelectMany(m => m.MappingEntries).Where(s => s.StageEntity.Name != "#").Select(ma => new CheckableContent<MappingEntry>(ma)).Union(
                            this.NotMappedAttributes.SelectMany(m => m.MappingEntries).Where(s => s.StageEntity.Name != "#").Select(ma => new CheckableContent<MappingEntry>(ma)))
                    )
                };
            if ((this.dialogService.ShowDialog(this, editAttributeViewModel) ?? false) == true)
            {
                obj.MappingEntries.Clear();
                obj.MappingEntries.AddRange(editAttributeViewModel.AttributeMapping.Select(c => c.Content));

                // remove all mappings
                foreach (var s in this.Item.Function.Source)
                {
                    if (s.Dm8l == "#")
                        continue;

                    foreach (var m in s.Mapping)
                    {
                        if (m.Name == obj.Attribute.Name)
                        {
                            m.Name = null;
                        }
                    }    
                }
                

                // save mapping
                foreach (var nm in obj.MappingEntries)
                {
                    var se = this.Item.Function.Source.FirstOrDefault(s => s.Dm8l == nm.StageEntity.Dm8l);
                    if (se == null)
                        continue;

                    var me = se.Mapping.FirstOrDefault(m => m.SourceName == nm.SourceName);
                    if (me == null)
                        continue;

                    me.Name = nm.Name;
                }

                obj.InfoPropertiesChanged();
            }


            await Task.Yield();
        }

        private async Task RenameAttributeAsync(Attribute attr, string oldName)
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
                var checkRefs = this.ShowMessageBox(string.Format(Properties.Resources.CoreModelEntryViewModel_CheckReferences, this.Item.Entity.Dm8l, refList.Select((e => e.Value)).ToCommaList()),
                    Resources.CoreModelEntryViewModel_Update_Referenced_Entities, MessageBoxButton.YesNo);
                if (checkRefs == MessageBoxResult.Yes)
                {
                    oneObjectChanged = await this.solutionService.SolutionHelper.RenameAttributeAsync(dm8lEntity, oldName, attr.Name);
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


        private string? getDefaultTypeForDataType(string datatype)
        {
            switch (datatype)
            {
                case "decimal":
                    datatype = "double";
                    break;
                case "long":
                    datatype = "int";
                    break;
            }
            var newTypeDefault = this.AttributeTypes.FirstOrDefault(x =>
                x.DefaultType == datatype && x.IsDefaultProperty == true)?.Name;

            if (newTypeDefault != null)
            {
                return newTypeDefault;
            }
            newTypeDefault = this.AttributeTypes.FirstOrDefault(x =>
                x.DefaultType == "string" && x.IsDefaultProperty == true)?.Name;
            return newTypeDefault;
        }

        #region Realtionship
        private async Task AddRelationshipAsync()
        {
            // Create Relationship 
            var viewModel = new DlgCoreEntityEditRelationshipViewModel(this.dialogService, this.solutionService)
            {
                CoreEntity = this.Item.Entity
            };
            if (this.dialogService.ShowDialog(this, viewModel) ?? false)
            {
                this.Item.Entity.Relationship.Add(
                    new Relationship
                    {
                        Dm8lKey = viewModel.KeyCoreModel.Entity.Dm8l,
                        Role = viewModel.Role ?? "#",
                        Fields = new ObservableCollection<RelationshipField>(
                            viewModel.KeyAttributes.Select(a => new RelationshipField
                            {
                                Dm8lKeyAttr = new Dm8lAttribute(viewModel.KeyCoreModel.Entity.Dm8l + "/" + a.KeyAttribute.Name).Value,
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
            var viewModel = new DlgCoreEntityEditRelationshipViewModel(this.dialogService, this.solutionService)
                {
                    CoreEntity = this.Item.Entity
                };
            if (this.dialogService.ShowDialog(this, viewModel) ?? false)
            {
                this.Item.Entity.Relationship.Add(
                    new Relationship
                    {
                        Dm8lKey = viewModel.KeyCoreModel.Entity.Dm8l, 
                        Role = viewModel.Role ?? "#",
                        Fields = new ObservableCollection<RelationshipField>(
                            viewModel.KeyAttributes.Select(a => new RelationshipField
                            {
                                    Dm8lKeyAttr = new Dm8lAttribute(viewModel.KeyCoreModel.Entity.Dm8l + "/" + a.KeyAttribute.Name).Value,
                                    Dm8lAttr = a.SelectedAttribute!= null ? new Dm8lAttribute(this.Item.Entity.Dm8l + "/" + a.SelectedAttribute.Name).Value : null
                            })
                         )
                    });
            }

            await Task.Yield();
        }

        private async Task EditRelationshipAsync(Relationship ra)
        {
            // Create Relationship for selected attribute
            var viewModel = new DlgCoreEntityEditRelationshipViewModel(this.dialogService, this.solutionService)
                {
                    CoreEntity = this.Item.Entity,
                    Relationship = ra
                };
            if (this.dialogService.ShowDialog(this, viewModel) ?? false)
            {
                ra.Dm8lKey = viewModel.KeyCoreModel.Entity.Dm8l;
                ra.Role = viewModel.Role ?? "#";
                ra.Fields = new ObservableCollection<RelationshipField>(
                    viewModel.KeyAttributes.Select(a => new RelationshipField
                    {
                        Dm8lKeyAttr = viewModel.KeyCoreModel.Entity.Dm8l + "/" + a.KeyAttribute.Name,
                        Dm8lAttr = a.SelectedAttribute != null
                            ? this.Item.Entity.Dm8l + "/" + a.SelectedAttribute.Name
                            : null
                    })
                );
            }

            await Task.Yield();
        }


        #endregion
    }
}

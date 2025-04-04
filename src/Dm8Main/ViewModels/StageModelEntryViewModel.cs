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
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using Dm8Data;
using Dm8Data.DataTypes;
using Dm8Data.Helper;
using Dm8Data.Validate;
using Dm8Data.Validate.Exceptions;
using Dm8Main.Models;
using Dm8Main.Services;
using Dm8Main.Views;
using MvvmDialogs;
using Newtonsoft.Json;
using NJsonSchema.CodeGeneration.CSharp;
using Prism.Commands;
using Prism.Events;
using Unity;

namespace Dm8Main.ViewModels
{
    [Export]
    public class StageModelEntryViewModel : DocumentViewModel<Dm8Data.Stage.ModelEntry>
    {
        #region Property SelectedIndex
        public int SelectedIndex
        {
            get => this.selectedIndex;
            set => this.SetProperty(ref this.selectedIndex, value);
        }

        private int selectedIndex;
        #endregion

        #region Property DataTypes
        public ObservableCollection<Dm8Data.DataTypes.DataType> DataTypes
        {
            get => this.dataTypes;
            set => this.SetProperty(ref this.dataTypes, value);
        }

        private ObservableCollection<Dm8Data.DataTypes.DataType> dataTypes;
        #endregion

        #region Property StageEntities
        public ObservableCollection<Dm8Data.Stage.ModelEntry> StageEntries
        {
            get => this.stageEntries;
            set => this.SetProperty(ref this.stageEntries, value);
        }

        private ObservableCollection<Dm8Data.Stage.ModelEntry> stageEntries;
        #endregion

        public StageModelEntryViewModel(IUnityContainer unityContainer, ISolutionService solutionService, IEventAggregator eventAggregator, IDialogService dialogService)
            : base(unityContainer, solutionService, eventAggregator, dialogService)
        {
            this.Title = Properties.Resources.Title_RawEntity;
            this.PropertyChanged += this.StageEntityViewModel_PropertyChanged;

            this.StageEntries = new ObservableCollection<Dm8Data.Stage.ModelEntry>();
        }

        private void StageEntityViewModel_PropertyChanged(object? sender, PropertyChangedEventArgs e)
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

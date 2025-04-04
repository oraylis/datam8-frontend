using System;
using System.Collections.ObjectModel;
using System.Composition;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using Dm8Data.Core;
using Dm8Data.DataProducts;
using Dm8Data.Helper;
using Dm8Data.Validate;
using Dm8Main.Base;
using Dm8Main.Models;
using Dm8Main.Services;
using MvvmDialogs;
using Newtonsoft.Json;
using Prism.Commands;

namespace Dm8Main.ViewModels.Dialog
{

    [Export]
    public class DlgCoreAttributeEditViewModel : Prism.Mvvm.BindableBase, IModalDialogViewModel
    {
        private readonly ISolutionService solutionService;

        private readonly IDialogService dialogService;

        public bool? DialogResult { get; set; }

        #region Property LoadedCommand
        public DelegateCommand LoadedCommand
        {
            get => this.loadedCommand;
            set => this.SetProperty(ref this.loadedCommand, value);
        }

        private DelegateCommand loadedCommand;
        #endregion

        #region Property Attribute
        public Dm8Data.Core.Attribute Attribute
        {
            get => this.attribute;
            set => this.SetProperty(ref this.attribute, value);
        }
        private Dm8Data.Core.Attribute attribute;
        #endregion

        #region Property AttributeTypes
        public ObservableCollection<Dm8Data.AttributeTypes.AttributeType> AttributeTypes
        {
            get => this.attributeTypes;
            set => this.SetProperty(ref this.attributeTypes, value);
        }

        private ObservableCollection<Dm8Data.AttributeTypes.AttributeType> attributeTypes;
        #endregion

        #region Property HistoryTypes
        public ObservableCollection<Dm8Data.Core.AttributeHistory> HistoryTypes
        {
            get => this.historyTypes;
            set => this.SetProperty(ref this.historyTypes, value);
        }
        private ObservableCollection<Dm8Data.Core.AttributeHistory> historyTypes;
        #endregion

        #region Property UnitAttributes
        public ObservableCollection<Dm8Data.Core.Attribute> UnitAttributes
        {
            get => this.unitAttributes;
            set => this.SetProperty(ref this.unitAttributes, value);
        }

        private ObservableCollection<Dm8Data.Core.Attribute> unitAttributes;
        #endregion

        #region Property DataTypes
        public ObservableCollection<Dm8Data.DataTypes.DataType> DataTypes
        {
            get => this.dataTypes;
            set => this.SetProperty(ref this.dataTypes, value);
        }

        private ObservableCollection<Dm8Data.DataTypes.DataType> dataTypes;
        #endregion

        #region Property SelectedDataType
        public Dm8Data.DataTypes.DataType SelectedDataType
        {
            get => this.selectedDataType;
            set => this.SetProperty(ref this.selectedDataType, value);
        }

        private Dm8Data.DataTypes.DataType selectedDataType;
        #endregion

        #region Property CharLenVisible
        public Visibility CharLenVisible
        {
            get => this.charLenVisible;
            set => this.SetProperty(ref this.charLenVisible, value);
        }

        private Visibility charLenVisible;
        #endregion

        #region Property PrecisionVisible
        public Visibility PrecisionVisible
        {
            get => this.precisionVisible;
            set => this.SetProperty(ref this.precisionVisible, value);
        }

        private Visibility precisionVisible;
        #endregion

        #region Property ScaleVisible
        public Visibility ScaleVisible
        {
            get => this.scaleVisible;
            set => this.SetProperty(ref this.scaleVisible, value);
        }

        private Visibility scaleVisible;
        #endregion


        #region Property OKCommand
        public DelegateCommand<IClosableWindow> OKCommand
        {
            get => this.okCommand;
            set => this.SetProperty(ref this.okCommand, value);
        }

        private DelegateCommand<IClosableWindow> okCommand;
        #endregion

        #region Property CancelCommand
        public DelegateCommand<IClosableWindow> CancelCommand
        {
            get => this.cancelCommand;
            set => this.SetProperty(ref this.cancelCommand, value);
        }

        private DelegateCommand<IClosableWindow> cancelCommand;
        #endregion

        public DlgCoreAttributeEditViewModel(IDialogService dialogService, ISolutionService solutionService)
        {
            this.solutionService = solutionService;
            this.dialogService = dialogService;

            this.PropertyChanged += this.DlgCoreAttributeEditViewModel_PropertyChanged;
            this.OKCommand = new DelegateCommand<IClosableWindow>(this.OnOK);
            this.CancelCommand = new DelegateCommand<IClosableWindow>(this.OnCancel);
            this.LoadedCommand = new DelegateCommand(this.OnLoaded);
        }

        private async void OnLoaded()
        {
            try
            {
                await Task.Yield();
            }
            catch (Exception ex)
            {
                this.dialogService.ShowException(this, ex);
            }
        }

        private async void DlgCoreAttributeEditViewModel_PropertyChanged(object sender, System.ComponentModel.PropertyChangedEventArgs e)
        {
            
            switch(e.PropertyName)
            {
                case nameof(this.Attribute):
                case nameof(this.DataTypes):
                    if (this.DataTypes != null && this.Attribute != null)
                        this.SelectedDataType = this.DataTypes.FirstOrDefault(dt => dt.Name == this.Attribute.DataType);
                    break;

                case nameof(this.SelectedDataType):
                    if (this.SelectedDataType.HasCharLen)
                    {
                        this.CharLenVisible = Visibility.Visible;
                    }
                    else
                    {
                        this.CharLenVisible = Visibility.Collapsed;
                    }

                    if (this.SelectedDataType.HasPrecision)
                    {
                        this.PrecisionVisible = Visibility.Visible;
                    }
                    else
                    {
                        this.PrecisionVisible = Visibility.Collapsed;
                    }

                    if (this.SelectedDataType.HasScale)
                    {
                        this.ScaleVisible = Visibility.Visible;
                    }
                    else
                    {
                        this.ScaleVisible = Visibility.Collapsed;
                    }

                    if (this.DataTypes != null && this.Attribute != null && this.AttributeTypes != null)
                    {
                        var currentType = this.Attribute.AttributeType;
                        var newType = this.AttributeTypes
                            .FirstOrDefault(x => x.DefaultType == this.SelectedDataType?.Name)?.Name;
                        var newTypeDefault = this.AttributeTypes.FirstOrDefault(x =>
                            x.DefaultType == this.SelectedDataType?.Name && x.IsDefaultProperty == true)?.Name;
                        if (newTypeDefault != null)
                        {
                            this.Attribute.AttributeType = newTypeDefault;
                        }
                        else
                        {
                            if (newType != null)
                            {
                                this.Attribute.AttributeType = newType;
                            }
                        }
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
            }
            catch (Exception ex)
            {
                this.dialogService.ShowException(this, ex);
            }
        }

        private void OnCancel(IClosableWindow window)
        {
            window.DialogResult = false;
            this.DialogResult = false;
        }
    }
}

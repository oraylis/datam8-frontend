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
using Dm8Data.Helper;
using Dm8Data.Validate;
using Dm8Data.Validate.Exceptions;
using Dm8Main.Models;
using Dm8Main.Services;
using Newtonsoft.Json;
using NJsonSchema.CodeGeneration.CSharp;
using Prism.Commands;
using Prism.Events;
using MvvmDialogs;
using Unity;

namespace Dm8Main.ViewModels
{
    [Export]
    public class AttributeTypesViewModel : DocumentListViewModel<Dm8Data.AttributeTypes.AttributeType,
        Dm8Data.AttributeTypes.AttributeTypes>
    {
        #region Property DataTypes

        public ObservableCollection<Dm8Data.DataTypes.DataType> DataTypes
        {
            get => this.dataTypes;
            set => this.SetProperty(ref this.dataTypes, value);
        }

        private ObservableCollection<Dm8Data.DataTypes.DataType> dataTypes;

        #endregion

        public AttributeTypesViewModel(IUnityContainer container, ISolutionService solution, IEventAggregator eventAggregator, IDialogService dialogService)
            : base(container, solution, eventAggregator, dialogService)
        {
            this.Title = Properties.Resources.Title_AttributeTypes;
        }

        protected override async Task<bool> LoadInternalAsync()
        {
            // read items
            await base.LoadInternalAsync();

            try
            {
                // Read data types
                DataTypeModelReader dataSourceModelReader = new DataTypeModelReader();
                var dataTypes = await dataSourceModelReader.ReadFromFileAsync(this.solution.DataTypesFilePath);
                if (this.DataTypes == null)
                    this.DataTypes = new ObservableCollection<Dm8Data.DataTypes.DataType>(dataTypes);
                else
                    this.DataTypes.Update(dataTypes, (i) => i.Name);


            }
            catch (Exception ex)
            {
                this.ErrorList.Add(new UnknownValidateException(ex, this.FilePath));
            }
            return true;
        }
    }
}

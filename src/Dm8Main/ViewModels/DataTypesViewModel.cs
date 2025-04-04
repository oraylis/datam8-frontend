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
    public class DataTypesViewModel : DocumentListViewModel<Dm8Data.DataTypes.DataType, Dm8Data.DataTypes.DataTypes>
    {
        public DataTypesViewModel(Dm8Data.Solution solution, IUnityContainer container, ISolutionService globalSettings, IEventAggregator eventAggregator, IDialogService dialogService)
            : base(container, globalSettings, eventAggregator, dialogService)
        {
            this.Title = Properties.Resources.Title_DataTypes;
        }


 
    }
}

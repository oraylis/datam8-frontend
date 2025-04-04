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
using MvvmDialogs;
using Newtonsoft.Json;
using NJsonSchema.CodeGeneration.CSharp;
using Prism.Commands;
using Prism.Events;
using Unity;

namespace Dm8Main.ViewModels
{
    [Export]
    public class DataProductsViewModel : DocumentListViewModel<Dm8Data.DataProducts.DataProduct, Dm8Data.DataProducts.DataProducts>
    {
        public DataProductsViewModel(IUnityContainer container, ISolutionService globalSettings, IEventAggregator eventAggregator, IDialogService dialogService)
            : base(container, globalSettings, eventAggregator, dialogService)
        {
            this.Title = Properties.Resources.Title_DataModules;
        }
 
    }
}

using System;
using System.Collections;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.ComponentModel;
using System.Composition;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;
using Dm8Data.DataTypes;
using Dm8Data.Generic;
using Dm8Data.Helper;
using Dm8Data.Validate;
using Dm8Data.Validate.Exceptions;
using Dm8Main.Models;
using Dm8Main.Services;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Prism.Commands;
using Prism.Events;
using MvvmDialogs;
using Unity;

namespace Dm8Main.ViewModels
{
    [Export]
    public abstract class DocumentListViewModel<TObj, TObjList> : DocumentViewModelBase 
        where TObj : Prism.Mvvm.BindableBase, new()
        where TObjList : class, IModelEntryList<TObj>, new()
    {
        private bool loading = false;

        private bool updatingItems = false;

        private bool updatingJson = false;

        private int oldSelectedItemNr = 0;

        protected Dm8Data.Solution solution;

        #region Property Items
        public ObservableCollection<TObj> Items
        {
            get => this.items;
            set => this.SetProperty(ref this.items, value);
        }

        public ObservableCollection<TObj> items;
        #endregion

        #region Property SelectedItem
        public TObj SelectedItem
        {
            get => this.selectedItem;
            set => this.SetProperty(ref this.selectedItem, value);
        }

        public TObj selectedItem;
        #endregion


        public DocumentListViewModel(IUnityContainer container, ISolutionService solutionService, IEventAggregator eventAggregator, IDialogService dialogService)
            : base(solutionService, eventAggregator, dialogService)
        {
            this.solution = solutionService.Solution;
            if (this.solution == null)
                throw new ArgumentNullException(nameof(this.solution));

            this.eventAggregator = eventAggregator;
            this.solutionService.PropertyChanged += this.SolutionServicePropertyChanged;

            this.IsModified = false;
            this.PropertyChanged += this.DocumentViewModel_PropertyChanged;
        }


        private void SolutionServicePropertyChanged(object sender, PropertyChangedEventArgs e)
        {
            if (e.PropertyName == nameof(SolutionService.Theme))
            {
                // change syntax highlighting
            }
        }


        private void DocumentViewModel_PropertyChanged(object sender, PropertyChangedEventArgs e)
        {
            switch (e.PropertyName)
            {
                case nameof(this.JsonCode):
                    System.Windows.Application.Current.Dispatcher.Invoke(async () => await this.UpdateFromJsonCodeAsync());
                    break;
            }           
        }

        private void Items_CollectionChanged(object sender, NotifyCollectionChangedEventArgs e)
        {
            if (e.Action == NotifyCollectionChangedAction.Add && e.NewItems != null)
            {
                foreach (var n in e.NewItems.OfType<Prism.Mvvm.BindableBase>())
                {
                    this.RegisterItemChanged(n);
                }
            }
            System.Windows.Application.Current.Dispatcher.Invoke(async () => await this.UpdateFromItemsAsync());            
        }



        private async void Item_PropertyChanged(object sender, PropertyChangedEventArgs e)
        {
            this.IsModified = true;

            await this.UpdateFromItemsAsync();
        }

        private void RegisterItemChanged(INotifyPropertyChanged n)
        {
            if (n == null)
                return;

            // register for property changes
            n.PropertyChanged += this.Item_PropertyChanged;

            // register sub objects
            foreach (var prop in n.GetType().GetProperties())
            {

                if (typeof(INotifyCollectionChanged).IsAssignableFrom(prop.PropertyType))
                {
                    if (prop.GetValue(n) is INotifyCollectionChanged collection)
                    {
                        collection.CollectionChanged += this.Items_CollectionChanged;
                    }                       
                }
                else if (typeof(INotifyPropertyChanged).IsAssignableFrom(prop.PropertyType))
                {
                    var sub = (INotifyPropertyChanged)prop.GetValue(n);
                    if (sub != null)
                    {
                        this.RegisterItemChanged(sub);
                    }
                }
                if (typeof(IEnumerable).IsAssignableFrom(prop.PropertyType) && prop.PropertyType != typeof(string)) 
                {
                    if (prop.GetValue(n) is IEnumerable collection)
                    {
                        foreach (var sub in collection.OfType<INotifyPropertyChanged>())
                        {
                            this.RegisterItemChanged(sub);
                        }
                    }
                }
            }
            // TODO recursive register
        }

        protected override async Task LoadInternalAsync()
        {
            this.FilePath = this.ProjectItem.FilePath;
            this.ToolTip = $"{this.ProjectItem.Type} - {this.ProjectItem.Name} ({this.ProjectItem.RelativeFilePath})";
            this.Title = this.ProjectItem.Name;

            // reload from json directly (not via change event)
            this.PropertyChanged -= this.DocumentViewModel_PropertyChanged;
            this.loading = true;
            try
            {
                // load file and items
                if (!File.Exists(this.FilePath))
                {
                    await FileHelper.WriteFileAsync(this.FilePath, string.Empty);
                }

                var jsonCode = await FileHelper.ReadFileAsync(this.FilePath);
                this.IsModified = false;
                if (jsonCode != this.JsonCode || !this.IsJsonLoaded)
                {
                    this.JsonCode = jsonCode;
                    await this.UpdateFromJsonCodeAsync();
                }
                else
                {
                    this.ErrorList = new ObservableCollection<ModelReaderException>();
                    await this.ValidateAsync();
                }
            }
            finally
            {
                this.loading = false;
                this.PropertyChanged += this.DocumentViewModel_PropertyChanged;
            }

            this.IsModified = false;
        }

        protected override async Task SaveInternalAsync()
        {
            // save file
            if (!this.IsModified)
                return;

            this.IsSaving = true;
            try
            {
                // reset error list
                this.ErrorList.Clear();

                await FileHelper.WriteFileAsync(this.FilePath, this.JsonCode);
                this.IsModified = false;

                // check errors
                await this.ValidateAsync();
            }
            catch (Exception ex)
            {
                this.ErrorList.Add(new UnknownValidateException(ex, this.FilePath));
            }
            finally
            {
                this.IsSaving = false;
            }
        }


        public override async Task ValidateAsync()
        {
            var v = ModelReaderFactory.Create(typeof(TObj));
            var newErrorList = await v.ValidateObjectAsync(this.solutionService.SolutionHelper, this.Items);
            this.ErrorList = new ObservableCollection<ModelReaderException>(this.ErrorList.Union(newErrorList));
        }

        public async Task UpdateFromJsonCodeAsync()
        {
            if (this.updatingItems)
            {
                this.updatingItems = false;
                return;
            }
            
            this.updatingJson = true;
            this.oldSelectedItemNr = 0;
            if (this.Items != null)
            {
                foreach (var i in this.Items)
                {
                    if (i == this.SelectedItem)
                        break;
                    this.oldSelectedItemNr++;
                }
            }

            var items = new ObservableCollection<TObj>();
            this.ErrorList = new ObservableCollection<ModelReaderException>();
            var newErrorList = new List<ModelReaderException>();
            try
            {
                if (!string.IsNullOrWhiteSpace(this.JsonCode))
                {
                    var anonymousItems = JsonConvert.DeserializeObject<TObjList>(this.JsonCode);
                    var itemList = anonymousItems.Values;
                    items = new ObservableCollection<TObj>(itemList.Where(i => i != null));
                }
                
                this.Items = items;
                this.IsJsonLoaded = true;

                await System.Windows.Application.Current.Dispatcher.BeginInvoke(new Action(() =>
                {
                    this.Items.CollectionChanged += this.Items_CollectionChanged;
                    foreach (var i in this.Items)
                    {
                        this.RegisterItemChanged(i);
                    }

                    this.ReselectItem();
                }));
            }
            catch (JsonSerializationException jsonEx)
            {
                newErrorList.Add(new SchemaValidateException(jsonEx.Message, jsonEx.LineNumber, jsonEx.LinePosition, FilePath));
            }
            catch (Exception ex)
            {
                try
                {
                    var obj = JToken.Parse(this.JsonCode);
                }
                catch (JsonReaderException jsonEx)
                {
                    newErrorList.Add(new UnknownValidateException(jsonEx, this.FilePath));
                }

                newErrorList.Add(new UnknownValidateException(ex, this.FilePath));
            }
            finally
            {
                this.ErrorList = new ObservableCollection<ModelReaderException>(this.ErrorList.Union(newErrorList));
                this.updatingJson = false;
                if (!this.loading)
                    this.IsModified = true;

                // set items
                this.Items = items;

                // check errors                
                await this.ValidateAsync();

            }
        }



        public async Task UpdateFromItemsAsync()
        {
            if (this.updatingJson)
            {
                this.updatingJson = false;
                return;
            }

            this.updatingItems = true;
            this.ErrorList = new ObservableCollection<ModelReaderException>();
            var newErrorList = new List<ModelReaderException>();
            try
            {
                string jsonCode = null;
                var result = new TObjList();
                foreach (var i in this.Items)
                {
                    result.Values.Add(i);
                }                        
                jsonCode = FileHelper.MakeJson(result);
                await System.Windows.Application.Current.Dispatcher.BeginInvoke(new Action(() =>
                {
                    this.JsonCode = jsonCode;
                    this.ReselectPosition();
                }));
            }
            catch (Exception ex)
            {
                newErrorList.Add(new UnknownValidateException(ex, this.FilePath));
            }
            finally
            {
                this.updatingItems = false;
                if (!this.loading)
                    this.IsModified = true;
                this.ErrorList = new ObservableCollection<ModelReaderException>(this.ErrorList.Union(newErrorList));
            }            
        }

        private void ReselectItem()
        {
            if (this.oldSelectedItemNr >= this.Items.Count)
                this.SelectedItem = this.Items.FirstOrDefault() ?? new TObj();
            else
            {
                this.SelectedItem = this.Items[this.oldSelectedItemNr];
            }
        }

        private void ReselectPosition()
        {

        }



    }
}

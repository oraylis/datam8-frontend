using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Composition;
using System.Data.Common;
using System.Linq;
using System.Reflection;
using System.Windows;
using Dm8Data.DataSources;
using Dm8Data.Helper;
using Dm8Data.Plugins;
using Dm8Data.Source;
using Dm8Data.Validate;
using Dm8Main.Base;
using Dm8Main.Views.Dialog;
using Dm8PluginBase.Interfaces;
using MahApps.Metro.Controls;
using Microsoft.Data.SqlClient;
using Microsoft.IdentityModel.Tokens;
using MvvmDialogs;
using Prism.Commands;
using static System.Windows.Forms.VisualStyles.VisualStyleElement;

namespace Dm8Main.ViewModels.Dialog
{

    [Export]
    public class DlgDataSourceEditViewModel : Prism.Mvvm.BindableBase, IModalDialogViewModel
    {
        private readonly IDialogService dialogService;

        private readonly Dm8Data.Solution solution;

        protected Dictionary<string, Type> typeDictionary = null;
        
        public bool? DialogResult { get; set; }
        public bool isPlugin = false;
        public string PluginType = "";
        public Dictionary<string, string> ExtendedProperties = new Dictionary<string, string>();

        #region Property LoadedCommand
        public DelegateCommand LoadedCommand
        {
            get => this.loadedCommand;
            set => this.SetProperty(ref this.loadedCommand, value);
        }

        public DelegateCommand loadedCommand;
        #endregion

        #region Property OKCommand
        public DelegateCommand<IClosableWindow> OKCommand
        {
            get => this.okCommand;
            set => this.SetProperty(ref this.okCommand, value);
        }

        public DelegateCommand<IClosableWindow> okCommand;
        #endregion

        #region Property CancelCommand
        public DelegateCommand<IClosableWindow> CancelCommand
        {
            get => this.cancelCommand;
            set => this.SetProperty(ref this.cancelCommand, value);
        }

        public DelegateCommand<IClosableWindow> cancelCommand;
        #endregion


        #region Property TestConnectionCommand
        public DelegateCommand<IClosableWindow> TestConnectionCommand
        {
            get => this.testConnectionCommand;
            set => this.SetProperty(ref this.testConnectionCommand, value);
        }

        public DelegateCommand<IClosableWindow> testConnectionCommand;
        #endregion

        #region Property IsConnecting
        public bool IsConnecting
        {
            get => this.isConnecting;
            set => this.SetProperty(ref this.isConnecting, value);
        }

        public bool isConnecting;
        #endregion

        #region Property TypeList
        public ObservableCollection<string> TypeList
        {
            get => this.typeList;
            set => this.SetProperty(ref this.typeList, value);
        }

        public ObservableCollection<string> typeList;
        #endregion

        #region Property SelectedItem
        public string SelectedItem
        {
            get => this.selectedItem;
            set => this.SetProperty(ref this.selectedItem, value);
        }

        public string selectedItem;
        #endregion

        #region Property ConnectionProperty
        public object ConnectionProperty
        {
            get => this.connectionProperty;
            set => this.SetProperty(ref this.connectionProperty, value);
        }

        public object connectionProperty;
        #endregion

        #region Property ConnectionString
        public string ConnectionString
        {
            get => this.connectionString;
            set => this.SetProperty(ref this.connectionString, value);
        }

        public string connectionString;
        #endregion

        #region Property DataSourceName
        public string DataSourceName
        {
            get => this.dataSourceName;
            set => this.SetProperty(ref this.dataSourceName, value);
        }

        public string dataSourceName;
        #endregion

        #region Property DataTypeMappings
        public ObservableCollection<Dm8Data.DataSources.DataTypeMapping> DataTypeMappings
        {
            get => this.dataTypeMappings;
            set => this.SetProperty(ref this.dataTypeMappings, value);
        }

        public ObservableCollection<Dm8Data.DataSources.DataTypeMapping> dataTypeMappings;
        #endregion

        #region Property DataTypes
        public ObservableCollection<string> DataTypes
        {
            get => this.dataTypes;
            set => this.SetProperty(ref this.dataTypes, value);
        }

        public ObservableCollection<string> dataTypes;
        #endregion
        

        public DlgDataSourceEditViewModel(IDialogService dialogService, Dm8Data.Solution solution)
        {
            this.dialogService = dialogService;
            this.solution = solution;
            this.PropertyChanged += this.DataSourceEditViewModel_PropertyChanged;
            this.OKCommand = new DelegateCommand<IClosableWindow>((w) => this.OnOK(w));
            this.CancelCommand = new DelegateCommand<IClosableWindow>((w) => this.OnCancel(w));
            this.TestConnectionCommand = new DelegateCommand<IClosableWindow>((w) => this.OnTestConnection(w));
            this.LoadedCommand = new DelegateCommand(()=>this.OnLoaded());
            this.IsConnecting = false;
        }


        private async void OnLoaded()
        {
            try
            {
                this.typeDictionary = new Dictionary<string, Type>();
                var types = Assembly.GetAssembly(typeof(Dm8Data.DataSources.DataSource)).GetTypes();
                this.TypeList = new ObservableCollection<string>();
                foreach (var t in types.Where(e => e.FullName.StartsWith("Dm8Data.Source.") && e.FullName.EndsWith("Source")))
                {
                    this.TypeList.Add(t.Name);
                    this.typeDictionary.Add(t.Name, t);
                }

                List<IDm8PluginConnectorSourceExplorerV1> plugins = DataSourceExplorerFactory.Plugins;
                foreach (var plugin in plugins)
                {
                    this.TypeList.Add(plugin.Name);
                    this.typeDictionary.Add(plugin.Name, plugin.GetType());
                }


                DataTypeModelReader dataTypeModelReader = new DataTypeModelReader();
                var dataTypes = await dataTypeModelReader.ReadFromFileAsync(this.solution.DataTypesFilePath);
                this.DataTypes = new ObservableCollection<string>(dataTypes.Select(dt => dt.Name));
                this.CreateConnectionProperty();
                this.FillConnectionProperty();
            }
            catch (Exception ex)
            {
                this.dialogService.ShowException(this, ex);
            }
        }

        private void DataSourceEditViewModel_PropertyChanged(object sender, System.ComponentModel.PropertyChangedEventArgs e)
        {
            switch (e.PropertyName)
            {
                case nameof(this.SelectedItem):
                    this.CreateConnectionProperty();
                    break;
                case nameof(this.ConnectionString):
                    this.FillConnectionProperty();
                    break;
            }
        }

        private void OnOK(IClosableWindow window)
        {
            if (!isPlugin)
            {
                if (!this.FillConnectionString())
                {
                    return;
                }
            }
            window.DialogResult = true;
            this.DialogResult = true;
            window.Close();
        }

        private void OnCancel(IClosableWindow window)
        {
            window.DialogResult = false;
            this.DialogResult = false;
        }

        private async void OnTestConnection(IClosableWindow window)
        {
            if (this.ConnectionProperty == null)
            {
                this.dialogService.ShowMessageBox(this, "Connection properties not specified");
                return;
            }


            if (!this.FillConnectionString())
            {
                this.dialogService.ShowMessageBox(this, "Connection string not valid");
                return;
            }

            this.IsConnecting = true;
            try
            {
                var db = DataSourceExplorerFactory.Create(this.ConnectionProperty.GetType());
                if (db == null)
                {
                    this.dialogService.ShowMessageBox(this,
                        $"Source not found {this.ConnectionProperty.GetType().Name}", "Error");
                }
                else
                {
                    db.Source = new Dm8Data.DataSources.DataSource { ConnectionString = this.ConnectionString };
                    await db.ConnectAsync(await SecretHelper.GetSecretsFromCacheAsync(db.Source.ConnectionString));
                    this.dialogService.ShowMessageBox(this,
                        $"Connection to source {this.ConnectionProperty.GetType().Name} successful", "Success");
                }
            }
            catch (Exception ex)
            {
                this.dialogService.ShowException(this, ex);
            }
            finally
            {
                this.IsConnecting = false;
            }

        }

        private void CreateConnectionProperty()
        {
            try
            {
                isPlugin = false;
                PluginType = "";
                if (!string.IsNullOrEmpty(this.selectedItem) && this.typeDictionary != null )
                {
                    if (this.typeDictionary[this.selectedItem] != null && this.typeDictionary[this.selectedItem].IsClass && PluginHelper.IsConnectorPlugin(this.typeDictionary[this.selectedItem]))
                    {
                        
                        IDm8PluginConnectorSourceExplorerV1 plugin = this.typeDictionary[this.selectedItem] as IDm8PluginConnectorSourceExplorerV1;
                        var pl = Activator.CreateInstance(this.typeDictionary[this.SelectedItem]) as IDm8PluginConnectorSourceExplorerV1;
                        var conStr = this.ConnectionString;
                        this.dialogService.Close(this);
                        pl.DataSourceName = this.DataSourceName;
                        if (pl.ConfigureConnection(ref conStr ,this.ExtendedProperties))
                        {
                            DataSourceName = pl.DataSourceName;
                            this.ConnectionString = conStr;
                            isPlugin = true;
                            PluginType = pl.Source.Name;
                            pl.Source.ExtendedProperties = this.ExtendedProperties;
                            if (this.DataTypeMappings == null || this.DataTypeMappings?.Count == 0 || this.DataTypeMappings.Count < pl.DefaultDatatypes.Count)
                            {
                                this.DataTypeMappings = new ObservableCollection<DataTypeMapping>();
                                var devList = pl.DefaultDatatypes;
                                foreach (KeyValuePair<string, string> kv in devList)
                                {
                                    this.DataTypeMappings.Add(new DataTypeMapping()
                                        { SourceType = kv.Key, TargetType = kv.Value });
                                }
                            }
                            this.DialogResult = true;
                        }
                        else
                        {
                            this.DialogResult = false;
                        }

                    }
                    else
                    {
                        this.ConnectionProperty = Activator.CreateInstance(this.typeDictionary[this.SelectedItem]);
                    }
                }
            }
            catch
            {
                this.ConnectionProperty = null;
            }
        }

        public bool FillConnectionString()
        {
            if (this.ConnectionProperty == null)
                return false;

            DbConnectionStringBuilder dbConnectionStringBuilder = new DbConnectionStringBuilder();
            foreach (var p in this.ConnectionProperty.GetType().GetProperties())
            {
                // get Name
                string n = p.GetCustomAttribute<Newtonsoft.Json.JsonPropertyAttribute>()?.PropertyName;

                // get value
                string v = p.GetValue(this.ConnectionProperty)?.ToString();
                if (p.PropertyType.BaseType == typeof(Enum) && p.PropertyType is TypeInfo ti)
                {
                    foreach (var m in ti.DeclaredMembers)
                    {
                        if (m.Name == v)
                        {
                            var enumVal = m.GetCustomAttribute<System.Runtime.Serialization.EnumMemberAttribute>()?.Value;
                            if (enumVal != "#Empty")
                                dbConnectionStringBuilder.Add(n, m.GetCustomAttribute<System.Runtime.Serialization.EnumMemberAttribute>()?.Value);
                        }
                    }                    
                }
                else if (!string.IsNullOrEmpty(n) && !string.IsNullOrEmpty(v))
                {
                    dbConnectionStringBuilder.Add(n, v);
                }
                    
            }

            this.ConnectionString = dbConnectionStringBuilder.ConnectionString;
            return true;
        }

        private void FillConnectionProperty()
        {
            if (string.IsNullOrEmpty(this.ConnectionString) || this.ConnectionProperty == null)
                return;

            try
            {
                DbConnectionStringBuilder dbConnectionStringBuilder = new DbConnectionStringBuilder();
                dbConnectionStringBuilder.ConnectionString = this.ConnectionString;
                var props = this.ConnectionProperty.GetType().GetProperties();
                foreach (var k in dbConnectionStringBuilder.Keys.OfType<string>())
                {
                    if (dbConnectionStringBuilder.TryGetValue(k, out object v))
                    {
                        // get name
                        var nameProp = props.
                                SelectMany(p => p.GetCustomAttributes<Newtonsoft.Json.JsonPropertyAttribute>().Select(a => new { Prop = p, Attrs =  a })).
                                Where(kv => StringComparer.InvariantCultureIgnoreCase.Compare(kv.Attrs.PropertyName, k) == 0).                                
                                FirstOrDefault();
                        if (nameProp == null)
                            continue;

                        // get value                        
                        if (nameProp.Prop.PropertyType.BaseType == typeof(Enum) && nameProp.Prop.PropertyType is TypeInfo ti)
                        {
                            // find value for string                            
                            var vStr = v.ToString();
                            if (string.IsNullOrEmpty(vStr))
                            {
                                vStr = "#Empty";
                            }
                            foreach (var m in ti.DeclaredMembers)
                            {
                                if (m.GetCustomAttribute<System.Runtime.Serialization.EnumMemberAttribute>()?.Value == vStr)
                                {
                                    nameProp.Prop.SetValue(this.ConnectionProperty, Enum.Parse(nameProp.Prop.PropertyType, m.Name));
                                }
                            }

                        }
                        else
                        {
                            nameProp.Prop.SetValue(this.ConnectionProperty, v);
                        }
                    }
                }
            }
            catch
            {
            }
        }
    }
}

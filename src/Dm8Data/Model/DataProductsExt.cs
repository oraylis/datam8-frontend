using System.Collections;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.Linq;
using Dm8Data.Base;
using Dm8Data.DataTypes;
using Dm8Data.Generic;

namespace Dm8Data.DataProducts
{
    public partial class DataProducts : Prism.Mvvm.BindableBase, IModelEntryList<DataProduct>
    {
        public DataProducts()
        {
            this.Items = new ObservableCollection<DataProduct>();
        }

        public ObservableCollection<DataProduct> Values => this.Items as ObservableCollection<DataProduct>;

        IEnumerable IModelEntryList.Values => this.Items;
    }

    public partial class DataModule : Prism.Mvvm.BindableBase
    {
        public void CallProperyChanged(string propertyName)
        {
            this.RaisePropertyChanged(propertyName);
        }
    }

    public partial class DataProduct : Prism.Mvvm.BindableBase
    {

        public DataProduct()
        {
            this.PropertyChanged += this.DataProduct_PropertyChanged;
            this.Module = new ObservableCollection<DataModule>();
            this.Module.CollectionChanged += ModuleOnCollectionChanged;
        }

        private void DataProduct_PropertyChanged(object sender, System.ComponentModel.PropertyChangedEventArgs e)
        {

        }

        private void ModuleOnCollectionChanged(object sender, NotifyCollectionChangedEventArgs e)
        {
        }
    }

}
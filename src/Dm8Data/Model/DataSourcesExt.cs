using System;
using System.Collections;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using Dm8Data.Base;
using Dm8Data.Generic;

namespace Dm8Data.DataSources
{
    public partial class DataSources : Prism.Mvvm.BindableBase, IModelEntryList<DataSource>
    {
        public DataSources()
        {
            this.Items = new ObservableCollection<DataSource>();
        }

        public ObservableCollection<DataSource> Values => this.Items as ObservableCollection<DataSource>;

        IEnumerable IModelEntryList.Values => this.Items;
    }

    public partial class DataSource
    {
        public Dictionary<string, string> ExtendedProperties = new Dictionary<string, string>();

    }
}

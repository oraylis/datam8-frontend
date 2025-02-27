using System.Collections;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using Dm8Data.Base;
using Dm8Data.Generic;

namespace Dm8Data.DataTypes
{
    public partial class DataTypes : Prism.Mvvm.BindableBase, IModelEntryList<DataType>
    {
        public DataTypes()
        {
            this.Items = new ObservableCollection<DataType>();
        }

        public ObservableCollection<DataType> Values => this.Items as ObservableCollection<DataType>;

        IEnumerable IModelEntryList.Values => this.Items;
    }


}

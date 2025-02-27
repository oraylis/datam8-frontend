using System;
using System.Collections;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using Dm8Data.Base;
using Dm8Data.DataTypes;
using Dm8Data.Generic;
using Newtonsoft.Json;

namespace Dm8Data.AttributeTypes
{
    public partial class AttributeTypes : Prism.Mvvm.BindableBase, IModelEntryList<AttributeType>
    {
        public AttributeTypes()
        {
            this.Items = new ObservableCollection<AttributeType>();
        }

        public ObservableCollection<AttributeType> Values => this.Items as ObservableCollection<AttributeType>;

        IEnumerable IModelEntryList.Values => this.Items;
    }
}

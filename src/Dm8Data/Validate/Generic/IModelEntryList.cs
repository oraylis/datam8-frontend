using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using Dm8Data.Base;
using Newtonsoft.Json;

namespace Dm8Data.Generic
{
    public interface IModelEntryList<TObj> : IModelEntryList
    {
        [JsonIgnore]
        new ObservableCollection<TObj> Values { get; }
    }
}
using System.Collections;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using Dm8Data.Base;
using Dm8Data.Generic;

namespace Dm8Data.Diagram
{
    public partial class Diagram : Prism.Mvvm.BindableBase
    {
        public Diagram()
        {
            this.CoreEntities = new ObservableCollection<string>();
            this.DiagramOptions = new ObservableCollection<Options>();
        }
    }


}

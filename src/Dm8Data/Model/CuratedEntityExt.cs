using Dm8Data.Validate;
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading.Tasks;
using Dm8Data.Helper;
using Newtonsoft.Json;

namespace Dm8Data.Curated
{


    public partial class CuratedFunction : Prism.Mvvm.BindableBase
    {
        public CuratedFunction()
        {
            this.Source = new ObservableCollection<Dm8Data.Curated.ComputationSourceEntity>();
        }
    }


    public partial class ModelEntry : Prism.Mvvm.BindableBase, ICoreModel
    {
        public ModelEntry()
        {
            this.Entity = new Dm8Data.Core.CoreEntity() { Layer = Properties.Resources.Layer_Curated };
            this.Function = new ObservableCollection<CuratedFunction>();
            this.PropertyChanged += ModelEntry_PropertyChanged;
        }

        private void ModelEntry_PropertyChanged(object sender, PropertyChangedEventArgs e)
        {
            if (e.PropertyName == nameof(Entity))
            {
                this.Entity.Layer = Properties.Resources.Layer_Curated;
            }
        }
    }
}

using Dm8Data.Validate;
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Dm8Data.Stage
{
    public partial class Attribute : Prism.Mvvm.BindableBase
    {
        public void CallProperyChanged(string propertyName)
        {
            this.RaisePropertyChanged(propertyName);
        }
    }

    public partial class StageEntity : Prism.Mvvm.BindableBase
    {
        public static readonly string SOURCE_ENTITY_LOCATOR = "DataProduct/DataModule/Name";

        public static readonly string[] resourceProperties = SOURCE_ENTITY_LOCATOR.Split('/');

        public StageEntity()
        {
            this.PropertyChanged += this.SourceEntity_PropertyChanged;
            this.Attribute = new ObservableCollection<Attribute>();
            this.Attribute.CollectionChanged += AttributeOnCollectionChanged;
            this.Tags = new ObservableCollection<string>();
            this.Parameters = new ObservableCollection<Parameter>();

        }

        private void AttributeOnCollectionChanged(object sender, NotifyCollectionChangedEventArgs e)
        {
            if (e.NewItems != null)
            {
                foreach (var a in e.NewItems.OfType<Attribute>())
                {
                    if (a.Tags == null)
                        a.Tags = new ObservableCollection<string>();
                    a.Tags.CollectionChanged += (s, e) => TagsOnCollectionChanged(a, s, e);
                }
            }
        }

        private void TagsOnCollectionChanged(Attribute attr, object sender, NotifyCollectionChangedEventArgs e)
        {
            attr.CallProperyChanged(nameof(attr.Tags));
        }

        private void SourceEntity_PropertyChanged(object sender, System.ComponentModel.PropertyChangedEventArgs e)
        {
            if (resourceProperties.Contains(e.PropertyName))
            {
                this.RaisePropertyChanged(nameof(this.Dm8l));
            }
        }

        [Newtonsoft.Json.JsonIgnore]
        public string Dm8l 
        { 
            get 
            {
                return $"/{Properties.Resources.Layer_Stage}/{this.DataProduct}/{this.DataModule}/{this.Name}";
            } 
        }
    }
}

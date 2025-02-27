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

namespace Dm8Data.Core
{
    public partial class Attribute : Prism.Mvvm.BindableBase
    {
        public void CallProperyChanged(string propertyName)
        {
            this.RaisePropertyChanged(propertyName);
        }
    }

    public partial class Relationship : Prism.Mvvm.BindableBase
    {
        public Relationship()
        {
            this.Fields = new ObservableCollection<RelationshipField>();
            this.Fields.CollectionChanged += this.FieldsOnCollectionChanged;
        }

        [JsonIgnoreAttribute]
        public string FieldInfo
        {
            get
            {
                return this.Fields.Select(f => f.Dm8lAttr).ToCommaList();
            }
        }

        private void FieldsOnCollectionChanged(object sender, NotifyCollectionChangedEventArgs e)
        {
            this.RaisePropertyChanged(nameof(this.FieldInfo));
        }

    }

    public partial class CoreEntity : Prism.Mvvm.BindableBase
    {
        public static readonly string CoreEntityLocator = "DataProduct/DataModule/Name";

        public static readonly string[] ResourceProperties = CoreEntityLocator.Split('/');

        [JsonIgnoreAttribute]
        public string Layer
        {
            get => this.layer;
            set
            {
                if (this.layer == null)
                {
                    this.layer = value;
                }
            }
        }

        private string layer;

        public CoreEntity()
        {
            this.PropertyChanged += this.CoreEntity_PropertyChanged;
            this.Attribute = new ObservableCollection<Attribute>();
            this.Attribute.CollectionChanged += AttributeOnCollectionChanged;
            this.Relationship = new ObservableCollection<Relationship>();
            this.Tags = new ObservableCollection<string>();
            this.Parameters = new ObservableCollection<Parameter>();
            this.RefactorNames = new ObservableCollection<string>();
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
                    a.PropertyChanged += AttrPropertyChanged;
                }
            }
        }

        private void AttrPropertyChanged(object sender, PropertyChangedEventArgs e)
        {
            if (sender is Attribute attr)
            {
                if (attr.RefactorNames == null)
                    attr.RefactorNames = new ObservableCollection<string>();
            }
            this.CallProperyChanged(nameof(this.Attribute));
        }

        private void TagsOnCollectionChanged(Attribute attr, object sender, NotifyCollectionChangedEventArgs e)
        {
            attr.CallProperyChanged(nameof(attr.Tags));
        }


        private void CoreEntity_PropertyChanged(object sender, System.ComponentModel.PropertyChangedEventArgs e)
        {
            if (ResourceProperties.Contains(e.PropertyName))
            {
                this.RaisePropertyChanged(nameof(this.Dm8l));
            }
        }

        public void CallProperyChanged(string propertyName)
        {
            this.RaisePropertyChanged(propertyName);
        }

        [Newtonsoft.Json.JsonIgnore]
        public string Dm8l => $"/{this.Layer}/{this.DataProduct}/{this.DataModule}/{this.Name}";
    }

    public partial class CoreFunction : Prism.Mvvm.BindableBase
    {
        public CoreFunction()
        {
            this.Source = new ObservableCollection<SourceEntity>();
        }
    }

    public partial class SourceEntity : Prism.Mvvm.BindableBase
    {
        public SourceEntity()
        {
            this.Mapping = new ObservableCollection<Mapping>();
        }
    }

    public partial class ModelEntry : Prism.Mvvm.BindableBase, ICoreModel
    {
        public ModelEntry()
        {
            this.Entity = new CoreEntity() { Layer = Properties.Resources.Layer_Core };
            this.Function = new CoreFunction();
            this.PropertyChanged += ModelEntry_PropertyChanged;
        }

        private void ModelEntry_PropertyChanged(object sender, PropertyChangedEventArgs e)
        {
            if (e.PropertyName == nameof(Entity))
            {
                this.Entity.Layer = Properties.Resources.Layer_Core;
            }
        }
    }
}

using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Dm8Data.Helper
{
    public class ObservableDictionary<TKey, TValue> : Dictionary<TKey, TValue>, INotifyCollectionChanged, INotifyPropertyChanged
    {
        public event NotifyCollectionChangedEventHandler CollectionChanged;
        public event PropertyChangedEventHandler PropertyChanged;

        public ObservableDictionary() : base() { }

        public ObservableDictionary(int capacity) : base(capacity) { }

        public ObservableDictionary(IEqualityComparer<TKey> comparer) : base(comparer) { }

        public ObservableDictionary(IDictionary<TKey, TValue> dictionary) : base(dictionary) { }

        public ObservableDictionary(int capacity, IEqualityComparer<TKey> comparer) : base(capacity, comparer) { }

        public ObservableDictionary(IDictionary<TKey, TValue> dictionary, IEqualityComparer<TKey> comparer) : base(dictionary, comparer) { }



        public new TValue this[TKey key]
        {
            get => base[key];
            set
            {
                var exist = base.TryGetValue(key, out var oldValue);
                var oldItem = new KeyValuePair<TKey, TValue>(key, oldValue);
                base[key] = value;
                var newItem = new KeyValuePair<TKey, TValue>(key, value);
                if (exist)
                {
                    this.OnCollectionChanged(new NotifyCollectionChangedEventArgs(NotifyCollectionChangedAction.Replace, newItem, oldItem, base.Keys.ToList().IndexOf(key)));
                }
                else
                {
                    this.OnCollectionChanged(new NotifyCollectionChangedEventArgs(NotifyCollectionChangedAction.Add, newItem, base.Keys.ToList().IndexOf(key)));
                    this.OnPropertyChanged(new PropertyChangedEventArgs(nameof(Count)));
                }
            }
        }

        public new void Add(TKey key, TValue value)
        {
            if (!base.ContainsKey(key))
            {
                var item = new KeyValuePair<TKey, TValue>(key, value);
                base.Add(key, value);
                this.OnCollectionChanged(new NotifyCollectionChangedEventArgs(NotifyCollectionChangedAction.Add, item, base.Keys.ToList().IndexOf(key)));
                this.OnPropertyChanged(new PropertyChangedEventArgs(nameof(Count)));
            }
        }

        public new bool Remove(TKey key)
        {
            if (!base.TryGetValue(key, out _)) 
                return false;

            var item = new KeyValuePair<TKey, TValue>(key, base[key]);
            var result = base.Remove(key);
            this.OnCollectionChanged(new NotifyCollectionChangedEventArgs(NotifyCollectionChangedAction.Remove, item, base.Keys.ToList().IndexOf(key)));
            this.OnPropertyChanged(new PropertyChangedEventArgs(nameof(this.Count)));
            return result;
        }

        public new void Clear()
        {
            base.Clear();
            this.OnCollectionChanged(new NotifyCollectionChangedEventArgs(NotifyCollectionChangedAction.Reset));
            this.OnPropertyChanged(new PropertyChangedEventArgs(nameof(this.Count)));
        }

        protected virtual void OnCollectionChanged(NotifyCollectionChangedEventArgs e)
        {
            this.CollectionChanged?.Invoke(this, e);
        }

        protected virtual void OnPropertyChanged(PropertyChangedEventArgs e)
        {
            this.PropertyChanged?.Invoke(this, e);
        }
    }
}

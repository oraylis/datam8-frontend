using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace Dm8Main.Models
{
    public interface IHierarchicalItem<T> where T : class, IHierarchicalItem<T>
    {
        string Name { get; set; }

        ObservableCollection<HierarchicalItem<T>> Children { get; }

        bool HasItems { get; }

        bool IsExpanded { get; set; }

        bool IsSelected { get; set; }

        T GetThis();

        void UpdateFrom(HierarchicalItem<T> other);

        void CopyAttributes(HierarchicalItem<T> other);

        public IEnumerable<HierarchicalItem<T>> GetItems();
    }
}
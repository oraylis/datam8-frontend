using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Dm8Data.Helper
{
    public static class ObservableCollectionExt
    {
        public static void Update<Type>(this ObservableCollection<Type> This, IEnumerable<Type> Other, Func<Type, string> identifier) 
        {

            // is changed or removed
            var dictOther = Other.Where(i => identifier(i) != null).ToDictionary(i => identifier(i));
            var toRemove = new List<Type>();
            for (int i=0; i<This.Count; i++)
            {
                if (identifier(This[i]) == null)
                    continue;

                // contains object -> update
                if (dictOther.TryGetValue(identifier(This[i]), out Type newObj))
                {
                    Copy(This[i], newObj);
                }
                else
                {
                    toRemove.Add(This[i]);
                }                
            }

            // remove item
            foreach (var item in toRemove)
            {
                This.Remove(item);
            }

            // find new item added
            var dictThis = This.ToDictionary(i => identifier(i));
            foreach (var item in Other)
            {
                // contains object
                if (dictThis.ContainsKey(identifier(item)))
                    continue;

                if (identifier(item) == null)
                    continue;

                This.Add(item);
            }
        }

        public static void Copy<Type>(Type parent, Type child)
        {
            var parentProperties = parent.GetType().GetProperties();
            var childProperties = child.GetType().GetProperties();

            foreach (var parentProperty in parentProperties)
            {
                foreach (var childProperty in childProperties)
                {
                    if (parentProperty.Name == childProperty.Name && parentProperty.PropertyType == childProperty.PropertyType)
                    {
                        childProperty.SetValue(child, parentProperty.GetValue(parent));
                        break;
                    }
                }
            }
        }
    }

}

using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;

namespace Dm8Locator
{
    /// <summary>
    /// Ignore case when comparing data resource locators
    /// </summary>
    /// <seealso cref="System.Collections.Generic.IEqualityComparer{DataRecource.Adl}" />
    public class Dm8LocatorTypeComparer : IEqualityComparer<Dm8LocatorBase>
    {
        /// <summary>
        /// The base equality comparer used in case no type specific comparer is available
        /// </summary>
        private IEqualityComparer<Dm8LocatorBase> baseEqualityComparer = Dm8LocatorComparer.Default;

        /// <summary>
        /// Dictionary of data resource locator equality comparer
        /// </summary>
        private Dictionary<Type, IEqualityComparer<Dm8LocatorBase>> equalityComparer = new Dictionary<Type, IEqualityComparer<Dm8LocatorBase>>();

        /// <summary>
        /// Adds a type specific comparer.
        /// </summary>
        /// <param name="type">The Adl type.</param>
        /// <param name="comp">The type specific comparer.</param>
        public void AddTypeComparer(Type type, IEqualityComparer<Dm8LocatorBase> comp)
        {
            this.equalityComparer.Add(type, comp);
        }

        /// <summary>
        /// Determines whether the specified objects are equal by ignoring case.
        /// </summary>
        /// <param name="x">The first object of type <paramref name="T" /> to compare.</param>
        /// <param name="y">The second object of type <paramref name="T" /> to compare.</param>
        /// <returns>
        ///   <see langword="true" /> if the specified objects are equal; otherwise, <see langword="false" />.
        /// </returns>
        public bool Equals([AllowNull] Dm8LocatorBase x, [AllowNull] Dm8LocatorBase y)
        {
           if (this.equalityComparer.TryGetValue(x.GetType(), out IEqualityComparer<Dm8LocatorBase> comp))
            {
                return comp.Equals(x, y);
            }
            else
            {
                return this.baseEqualityComparer.Equals(x, y);                
            }
        }

        /// <summary>
        /// Returns a hash code for this instance.
        /// </summary>
        /// <param name="obj">The object.</param>
        /// <returns>
        /// A hash code for this instance, suitable for use in hashing algorithms and data structures like a hash table. 
        /// </returns>
        public int GetHashCode([DisallowNull] Dm8LocatorBase obj)
        {
            return obj.ToString().GetHashCode();
        }
    }

}

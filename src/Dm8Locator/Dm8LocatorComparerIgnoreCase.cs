using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;

namespace Dm8Locator
{
    /// <summary>
    /// Ignore case when comparing data resource locators
    /// </summary>
    /// <seealso cref="System.Collections.Generic.IEqualityComparer{DataRecource.Adl}" />
    public class Dm8DataLocatorComparerIgnoreCase : IEqualityComparer<Dm8LocatorBase>
    {
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
            var xStr = x?.ToString();
            var yStr = y?.ToString();
            if (StringComparer.InvariantCultureIgnoreCase.Compare(xStr, yStr) == 0 &&
                x?.GetType() == y?.GetType())
                return true;
            else
                return false;
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

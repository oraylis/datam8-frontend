using System;
using System.Collections.Generic;

namespace Dm8Locator
{
    /// <summary>
    /// Represents a data resource locator comparison operation that uses specific case and culture-based
    //  comparison rules.
    /// </summary>
    public class Dm8LocatorComparer
    {
        /// <summary>
        /// Ignore case for comparing data resource locators
        /// </summary>
        private static readonly Dm8DataLocatorComparerIgnoreCase Dm8lComparerIgnoreCase = new Dm8DataLocatorComparerIgnoreCase();

        /// <summary>
        /// Gets the ignore case data resource comparer
        /// </summary>
        /// <value>
        /// The ignore case comparer
        /// </value>
        public static IEqualityComparer<Dm8LocatorBase> IgnoreCase => Dm8lComparerIgnoreCase;

        /// <summary>
        /// Gets the default comparer for data resource locators (implemented as IgnoreCase)
        /// </summary>
        /// <value>
        /// The default comparer.
        /// </value>
        public static IEqualityComparer<Dm8LocatorBase> Default => Dm8lComparerIgnoreCase;
    }

}

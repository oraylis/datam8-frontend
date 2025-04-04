using System.Collections.Generic;

namespace Dm8Locator
{

    /// <summary>
    /// Dictionary for data resource locators
    /// </summary>
    /// <typeparam name="TValue">The type of the dictionary value.</typeparam>
    /// <seealso cref="Dictionary{TKey,TValue}.Adl, TValue}" />
    public class Dm8LocatorDictionary<TValue> : Dictionary<Dm8LocatorBase, TValue>
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8DataLocatorDictionary{TValue}"/> class.
        /// </summary>
        public Dm8LocatorDictionary()
            :base(Dm8LocatorComparer.Default)
        {

        }
    }


    /// <summary>
    /// Pair of Data Resource locator
    /// </summary>
    public class Dm8DataLocatorPair
    {
        public Dm8LocatorBase left;

        public Dm8LocatorBase right;
    }



    /// <summary>
    /// Pair of Data Resource locator with children
    /// </summary>
    public class Dm8DataLocatorPairWithChildren : Dm8DataLocatorPair
    {
        public Dm8LocatorDictionary<Dm8DataLocatorPair> Children = new Dm8LocatorDictionary<Dm8DataLocatorPair>();
    }

}

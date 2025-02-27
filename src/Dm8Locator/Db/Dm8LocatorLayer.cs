using System;
using System.Linq;
using System.Runtime.Serialization;
using System.Security.Permissions;

namespace Dm8Locator.Db
{
    /// <summary>
    /// Data Resource Locator for database layers
    /// </summary>
    /// <seealso cref="DataRecource.Adl" />
    [Serializable]
    public sealed class Dm8LocatorLayer : Dm8LocatorBase
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorLayer"/> class.
        /// </summary>
        public Dm8LocatorLayer() : base(true) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorLayer"/> class.
        /// </summary>
        /// <param name="Adl">The database.</param>
        public Dm8LocatorLayer(string dm8l) : base(dm8l, true) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorLayer"/> class.
        /// </summary>
        /// <param name="copy">The data resource locator to copy.</param>
        public Dm8LocatorLayer(Dm8LocatorBase copy) : base(copy, true) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorLayer"/> class.
        /// </summary>
        /// <param name="info">The information.</param>
        /// <param name="context">The context.</param>
        public Dm8LocatorLayer(SerializationInfo info, StreamingContext context) : base(info, context) { }

        /// <summary>
        /// Creates the parent of type database.
        /// </summary>
        /// <param name="dm8l">The data resource locator.</param>
        /// <returns>Parent database</returns>
        protected override Dm8LocatorBase CreateParent(string dm8l) 
        {
            // check if this is not the root
            if (!string.IsNullOrEmpty(dm8l) && dm8l != Dm8DataLocatorSeperator.ToString())
                throw new InvalidDm8LocatorException(dm8l, "Layer must be root level (parent must not exist)");

            // no more parents
            return null;
        }
    }

}

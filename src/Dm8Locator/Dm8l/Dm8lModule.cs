using System;
using System.Linq;
using System.Runtime.Serialization;
using System.Security.Permissions;

namespace Dm8Locator.Dm8l
{
    /// <summary>
    /// Dm8-Adress for an entity
    /// </summary>
    [Serializable]
    public sealed class Dm8lModule : Dm8LocatorBase
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8lModule"/> class.
        /// </summary>
        public Dm8lModule() : base() { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8lModule"/> class.
        /// </summary>
        /// <param name="dma">The database.</param>
        public Dm8lModule(string dma) : base(dma) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8lModule"/> class.
        /// </summary>
        /// <param name="copy">The data mate locator to copy.</param>
        public Dm8lModule(Dm8LocatorBase copy) : base(copy) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="DmaEntity"/> class.
        /// </summary>
        /// <param name="info">The information.</param>
        /// <param name="context">The context.</param>
        public Dm8lModule(SerializationInfo info, StreamingContext context) : base(info, context) { }

        /// <summary>
        /// Creates the parent of type Module
        /// </summary>
        /// <param name="Adl">The dm8l.</param>
        /// <returns></returns>
        protected override Dm8LocatorBase CreateParent(string dm8l)
        {
            // no more parents
            return new Dm8lProduct(dm8l);
        }
    }

}

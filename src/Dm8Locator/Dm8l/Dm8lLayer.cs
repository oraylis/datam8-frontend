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
    public sealed class Dm8lLayer : Dm8LocatorBase
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8lEntity"/> class.
        /// </summary>
        public Dm8lLayer() : base(true) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8lEntity"/> class.
        /// </summary>
        /// <param name="dma">The database.</param>
        public Dm8lLayer(string dma) : base(dma, true) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8lEntity"/> class.
        /// </summary>
        /// <param name="copy">The data resource locator to copy.</param>
        public Dm8lLayer(Dm8LocatorBase copy) : base(copy) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8lEntity"/> class.
        /// </summary>
        /// <param name="info">The information.</param>
        /// <param name="context">The context.</param>
        public Dm8lLayer(SerializationInfo info, StreamingContext context) : base(info, context) { }

        /// <summary>
        /// Creates the parent of type Module
        /// </summary>
        /// <param name="Adl">The dm8l.</param>
        /// <returns></returns>
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

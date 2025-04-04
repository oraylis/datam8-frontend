using System;
using System.Linq;
using System.Runtime.Serialization;
using System.Security.Permissions;

namespace Dm8Locator.Dm8l
{
    /// <summary>
    /// Dm8-Adress for an attribute
    /// </summary>
    [Serializable]
    public sealed class Dm8lAttribute : Dm8LocatorBase
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8lAttribute"/> class.
        /// </summary>
        public Dm8lAttribute() : base() { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8lAttribute"/> class.
        /// </summary>
        /// <param name="dma">The database.</param>
        public Dm8lAttribute(string dma) : base(dma) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8lAttribute"/> class.
        /// </summary>
        /// <param name="entity">Entity the attribute belongs to</param>
        /// <param name="attrName">Name of attribute</param>
        public Dm8lAttribute(Dm8lEntity entity, string attrName) : base(Dm8LocatorBase.Concat(entity.Value, attrName)) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8lAttribute"/> class.
        /// </summary>
        /// <param name="copy">The data resource locator to copy.</param>
        public Dm8lAttribute(Dm8LocatorBase copy) : base(copy) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8lAttribute"/> class.
        /// </summary>
        /// <param name="info">The information.</param>
        /// <param name="context">The context.</param>
        public Dm8lAttribute(SerializationInfo info, StreamingContext context) : base(info, context) { }

        /// <summary>
        /// Creates the parent of type Module
        /// </summary>
        /// <param name="Adl">The dm8l.</param>
        /// <returns></returns>
        protected override Dm8LocatorBase CreateParent(string dm8l)
        {
            // no more parents
            return new Dm8lEntity(dm8l);
        }
    }

}

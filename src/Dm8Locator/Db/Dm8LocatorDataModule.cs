using System;
using System.Linq;
using System.Runtime.Serialization;
using System.Security.Permissions;

namespace Dm8Locator.Db
{
    [Serializable]
    public sealed class Dm8LocatorDataModule : Dm8LocatorBase
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorDataModule"/> class.
        /// </summary>
        public Dm8LocatorDataModule() : base() { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorDataModule"/> class.
        /// </summary>
        /// <param name="dm8l">The database.</param>
        public Dm8LocatorDataModule(string dm8l) : base(dm8l) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorDataModule"/> class.
        /// </summary>
        /// <param name="copy">The copy.</param>
        public Dm8LocatorDataModule(Dm8LocatorBase copy) : base(copy) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorDataModule"/> class.
        /// </summary>
        /// <param name="info">The information.</param>
        /// <param name="context">The context.</param>
        public Dm8LocatorDataModule(SerializationInfo info, StreamingContext context) : base(info, context) { }

        /// <summary>
        /// Creates the parent of type schema.
        /// </summary>
        /// <param name="dm8l">The data resource locator.</param>
        /// <returns>Parent schema</returns>
        protected override Dm8LocatorBase CreateParent(string dm8l) 
        {
            return new Dm8LocatorLayer(dm8l); 
        }
    }

}

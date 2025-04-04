using System;
using System.Linq;
using System.Runtime.Serialization;
using System.Security.Permissions;

namespace Dm8Locator.Db
{
    /// <summary>
    /// Data Resource Locator for database tables
    /// </summary>
    /// <seealso cref="DataRecource.Adl" />
    [Serializable]
    public sealed class Dm8LocatorDb : Dm8LocatorBase
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorDb"/> class.
        /// </summary>
        public Dm8LocatorDb() : base() { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorDb"/> class.
        /// </summary>
        /// <param name="dm8l">The database.</param>
        public Dm8LocatorDb(string dm8l) : base(dm8l) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorDb"/> class.
        /// </summary>
        /// <param name="copy">The data resource locator to copy.</param>
        public Dm8LocatorDb(Dm8LocatorBase copy) : base(copy) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorDb"/> class.
        /// </summary>
        /// <param name="info">The information.</param>
        /// <param name="context">The context.</param>
        public Dm8LocatorDb(SerializationInfo info, StreamingContext context) : base(info, context) { }

        /// <summary>
        /// Creates the parent.
        /// </summary>
        /// <param name="dm8l">The dm8l.</param>
        /// <returns></returns>
        /// <exception cref="DataRecource.InvalidAdlException">Db must be root level (parent does not exist)</exception>
        protected override Dm8LocatorBase CreateParent(string dm8l) 
        {
            return new Dm8LocatorDataModule(dm8l);
        }
    }

}

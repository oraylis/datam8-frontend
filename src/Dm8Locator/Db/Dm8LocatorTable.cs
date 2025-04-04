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
    public sealed class Dm8LocatorTable : Dm8LocatorBase
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorTable"/> class.
        /// </summary>
        public Dm8LocatorTable() : base() { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorTable"/> class.
        /// </summary>
        /// <param name="dm8l">The database.</param>
        public Dm8LocatorTable(string dm8l) : base(dm8l) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorTable"/> class.
        /// </summary>
        /// <param name="copy">The data resource locator to copy.</param>
        public Dm8LocatorTable(Dm8LocatorBase copy) : base(copy) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorTable"/> class.
        /// </summary>
        /// <param name="info">The information.</param>
        /// <param name="context">The context.</param>
        public Dm8LocatorTable(SerializationInfo info, StreamingContext context) : base(info, context) { }

        /// <summary>
        /// Creates the parent of type Module
        /// </summary>
        /// <param name="dm8l">The dm8l.</param>
        /// <returns></returns>
        protected override Dm8LocatorBase CreateParent(string dm8l)
        {
            // no more parents
            return new Dm8LocatorSchema(dm8l);
        }
    }

}

using System;
using System.Linq;
using System.Runtime.Serialization;
using System.Security.Permissions;

namespace Dm8Locator.Db
{
    /// <summary>
    /// Data Resource Locator for database views
    /// </summary>
    /// <seealso cref="DataRecource.Adl" />
    [Serializable]
    public sealed class Dm8LocatorView : Dm8LocatorBase
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorView"/> class.
        /// </summary>
        public Dm8LocatorView() : base() { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorView"/> class.
        /// </summary>
        /// <param name="db">The database.</param>
        public Dm8LocatorView(string db) : base(db) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorView"/> class.
        /// </summary>
        /// <param name="copy">The copy.</param>
        public Dm8LocatorView(Dm8LocatorBase copy) : base(copy) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorView"/> class.
        /// </summary>
        /// <param name="info">The information.</param>
        /// <param name="context">The context.</param>
        public Dm8LocatorView(SerializationInfo info, StreamingContext context) : base(info, context) { }

        /// <summary>
        /// Creates the parent of type Module
        /// </summary>
        /// <param name="dm8l">The dm8l.</param>
        /// <returns></returns>
        protected override Dm8LocatorBase CreateParent(string dm8l)
        {
            // no more parents
            return new Dm8LocatorDataModule(dm8l);
        }
    }

}

using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.Serialization;
using System.Security.Permissions;

namespace Dm8Locator.Db
{
    /// <summary>
    /// Data Resource Locator for SQL procedures
    /// </summary>
    /// <seealso cref="DataRecource.Adl" />
    [Serializable]
    public sealed class Dm8LocatorProcedure : Dm8LocatorBase
    {
        /// <summary>
        /// Gets or sets the source resources of the procedure.
        /// </summary>
        /// <value>
        /// The source resources.
        /// </value>
        public List<string> SourceResources { get; set; } = new List<string>();

        /// <summary>
        /// Gets or sets the target resources of the procedure.
        /// </summary>
        /// <value>
        /// The target resources.
        /// </value>
        public List<string> TargetResources { get; set; } = new List<string>();

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorProcedure"/> class.
        /// </summary>
        public Dm8LocatorProcedure() : base() { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorProcedure"/> class.
        /// </summary>
        /// <param name="dm8l">The dm8l.</param>
        public Dm8LocatorProcedure(string dm8l) : base(dm8l) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorProcedure"/> class.
        /// </summary>
        /// <param name="copy">The copy.</param>
        public Dm8LocatorProcedure(Dm8LocatorBase copy) : base(copy) { }

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8LocatorProcedure"/> class.
        /// </summary>
        /// <param name="info">The information.</param>
        /// <param name="context">The context.</param>
        public Dm8LocatorProcedure(SerializationInfo info, StreamingContext context) : base(info, context) { }

        /// <summary>
        /// Creates a module parent resource locator
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

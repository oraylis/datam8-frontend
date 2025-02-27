using System;
using System.Runtime.Serialization;

namespace Dm8Locator
{
    /// <summary>
    /// Exception for duplicate data resource locators
    /// </summary>
    /// <seealso cref="System.Exception" />
    [Serializable]
    public class DuplicateDm8LocatorException : Exception
    {
        /// <summary>
        /// Gets the data resource locator which appears twice in a specific resource.
        /// </summary>
        /// <value>
        /// The invalid data resource locator.
        /// </value>
        public Dm8LocatorBase DuplicateDm8Locator { get; private set; }

        /// <summary>
        /// Initializes a new instance of the <see cref="DuplicateDm8LocatorException"/> class.
        /// </summary>
        /// <param name="duplicateAdl">The Data Resource locator used twice in one solution.</param>
        public DuplicateDm8LocatorException(Dm8LocatorBase duplicateAdl)
        {
            this.DuplicateDm8Locator = duplicateAdl;
        }

        /// <summary>
        /// Initializes a new instance of the <see cref="DuplicateDm8LocatorException"/> class.
        /// </summary>
        /// <param name="duplicateAdl">The Data Resource locator used twice in one solution.</param>
        /// <param name="message">The message.</param>
        public DuplicateDm8LocatorException(Dm8LocatorBase duplicateAdl, string message) 
            : base(message)
        {
            this.DuplicateDm8Locator = duplicateAdl;
        }

        /// <summary>
        /// Initializes a new instance of the <see cref="DuplicateDm8LocatorException"/> class.
        /// </summary>
        /// <param name="duplicateAdl">The Data Resource locator used twice in one solution.</param>
        /// <param name="message">The message.</param>
        /// <param name="innerException">The inner exception.</param>
        public DuplicateDm8LocatorException(Dm8LocatorBase duplicateAdl, string message, Exception innerException) 
            : base(message, innerException)
        {
            this.DuplicateDm8Locator = duplicateAdl;
        }
    }
}

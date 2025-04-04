using System;
using System.Runtime.Serialization;

namespace Dm8Locator
{
    /// <summary>
    /// Exception for invalid data resource locators
    /// </summary>
    /// <seealso cref="System.Exception" />
    [Serializable]
    public class InvalidDm8LocatorException : Exception
    {
        /// <summary>
        /// Gets the invalid data resource locator.
        /// </summary>
        /// <value>
        /// The invalid data resource locator.
        /// </value>
        public string InvalidDm8DataLocator { get; private set; }

        ///// <summary>
        ///// Initializes a new instance of the <see cref="InvalidDm8LocatorException"/> class.
        ///// </summary>
        ///// <param name="invalidAdl">The invalid data resource locator.</param>
        //public InvalidDm8LocatorException(string invalidAdl)
        //{
        //    this.InvalidDm8DataLocator = invalidAdl;
        //}

        /// <summary>
        /// Initializes a new instance of the <see cref="InvalidDm8LocatorException"/> class.
        /// </summary>
        /// <param name="invalidAdl">The invalid data resource locator.</param>
        /// <param name="message">The message.</param>
        public InvalidDm8LocatorException(string invalidAdl, string message) 
            : base(message)
        {
            this.InvalidDm8DataLocator = invalidAdl;
        }

        /// <summary>
        /// Initializes a new instance of the <see cref="InvalidDm8LocatorException"/> class.
        /// </summary>
        /// <param name="invalidAdl">The invalid data resource locator.</param>
        /// <param name="message">The message.</param>
        /// <param name="innerException">The inner exception.</param>
        public InvalidDm8LocatorException(string invalidAdl, string message, Exception innerException) 
            : base(message, innerException)
        {
            this.InvalidDm8DataLocator = invalidAdl;
        }
    }
}

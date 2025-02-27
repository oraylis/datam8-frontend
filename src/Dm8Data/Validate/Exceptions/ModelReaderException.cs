using System;
using Dm8Data.Helper;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Collections;
using System.Runtime.Serialization;
using Microsoft.CodeAnalysis;

namespace Dm8Data.Validate.Exceptions
{
    public class ModelReaderException : Exception
    {
        public enum SeverityType
        {
            Info,
            Warning,
            Error,
            Critical
        }

        /// <summary>
        /// Validation Code
        /// </summary>
        public SeverityType Severity { get; protected set; } = SeverityType.Error;

        /// <summary>
        /// Validation Code
        /// </summary>
        public string Code { get; set; } = string.Empty;

        /// <summary>
        /// Resource Locator of the corresponding entity 
        /// </summary>
        public string Adl { get; set; } = string.Empty;


        /// <summary>
        /// Resource Locator of the corresponding entity 
        /// </summary>
        public string FilePath { get; set; } = string.Empty;

        /// <summary>
        /// Initializes a new instance of the System.Exception class.
        /// </summary>
        public ModelReaderException()
        {
        }

        /// <summary>
        /// Initializes a new instance of the System.Exception class with a specified error
        /// </summary>
        /// <param name="message">The message that describes the error.</param>
        public ModelReaderException(string message)
            : base(message)
        {
        }

        /// <summary>
        //  Initializes a new instance of the System.Exception class with a specified error
        //  message and a reference to the inner exception that is the cause of this exception.
        /// </summary>
        /// <param name="message">The error message that explains the reason for the exception. (Nothing in Visual Basic) if no inner exception is specified.</param>
        /// <param name="innerException">The exception that is the cause of the current exception, or a null reference. </param>
        public ModelReaderException(string message, Exception innerException)
            :base(message, innerException)
        {
        }

     
    }
}

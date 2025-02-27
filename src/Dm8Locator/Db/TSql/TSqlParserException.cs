using Microsoft.SqlServer.TransactSql.ScriptDom;
using System;
using System.Collections.Generic;
using System.Runtime.Serialization;

namespace Dm8Locator.Db.TSql
{
    /// <summary>
    /// Exception for TSql parser errors 
    /// </summary>
    /// <seealso cref="System.Exception" />
    [Serializable]
    public class TSqlParserException : Exception
    {
        /// <summary>
        /// Gets or sets the list of parser errors (optionally).
        /// </summary>
        /// <value>
        /// The error list.
        /// </value>
        public IList<ParseError> Errors { get; set; }

        /// <summary>
        /// Initializes a new instance of the <see cref="TSqlParserException"/> class.
        /// </summary>
        /// <param name="message">The message.</param>
        public TSqlParserException(string message) 
            : base(message)
        {            
        }

        /// <summary>
        /// Initializes a new instance of the <see cref="TSqlParserException"/> class.
        /// Specifies the list of parser errors.
        /// </summary>
        /// <param name="message">The exception message.</param>
        /// <param name="errors">The error list.</param>
        public TSqlParserException(string message, IList<ParseError> errors)
        : base(message)
        {
            this.Errors = errors;
        }

        /// <summary>
        /// Initializes a new instance of the <see cref="TSqlParserException"/> class.
        /// </summary>
        /// <param name="message">The parser error message.</param>
        /// <param name="innerException">The inner exception.</param>
        public TSqlParserException(string message, Exception innerException) 
            : base(message, innerException)
        {
        }
    }
}

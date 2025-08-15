/* DataM8
 * Copyright (C) 2024-2025 ORAYLIS GmbH
 *
 * This file is part of DataM8.
 *
 * DataM8 is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * DataM8 is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

using System;

namespace Dm8Data.Validate.Exceptions
{
   public class ModelReaderException:Exception
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
      public ModelReaderException(string message ,Exception innerException)
          : base(message ,innerException)
      {
      }


   }
}

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
   public class CoreMappingValidateException:ModelReaderException
   {
      public const string MessageFormat0 = "Core entity {0}: Attribute {0} of mapping for {1} does not exist";

      public string CoreEntityAdl { get; set; }

      public string SourceEntityAdl { get; set; }

      public string AttributeName { get; set; }

      public CoreMappingValidateException(string coreAdl ,string srcAdl ,string attrName ,string filepath)
          : base("Core Mapping Error")
      {
         this.Code = "C01";
         this.FilePath = filepath;
         this.CoreEntityAdl = coreAdl;
         this.SourceEntityAdl = srcAdl;
         this.AttributeName = attrName;
      }

      public CoreMappingValidateException(string msg ,string filepath)
          : base("Unknown Validate Exception" ,new Exception(msg))
      {
         this.Code = "C01";
         this.FilePath = filepath;
      }

      public override string Message => string.Format(MessageFormat0 ,this.CoreEntityAdl ,this.SourceEntityAdl ,this.AttributeName);

      public override string Source => this.FilePath;
   }
}

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
using System.Linq;

namespace Dm8Locator.Db
{
   public class Dm8DataLocatorDbParserBase
   {
      protected Func<string[] ,string> CreateDm8DataLocatorName = null;

      protected string DbName;

      public Dm8DataLocatorDbParserBase(string db ,Func<string[] ,string> createAdlName = null)
      {
         this.DbName = db;
         this.CreateDm8DataLocatorName = createAdlName ?? this.DefaultGetDm8DataLocatorName;
      }

      public string DefaultGetDm8DataLocatorName(string[] identifier)
      {
         // At least two identifiers [schema].[table]
         if (identifier.Length < 2)
         {
            throw new ArgumentOutOfRangeException(nameof(identifier) ,"Schema and Name are mandatory for identifiers");
         }

         // Max three identifiers [schema].[table].[column]
         if (identifier.Length > 3)
         {
            throw new ArgumentOutOfRangeException(nameof(identifier) ,"More than three identifiers");
         }

         // create Adl for database resource
         string AdlName = string.Empty;

         // Database
         AdlName += this.DbName;
         AdlName += Dm8LocatorBase.Dm8DataLocatorSeperator;

         // Layer
         AdlName += "TODO";
         AdlName += Dm8LocatorBase.Dm8DataLocatorSeperator;

         // Schema
         AdlName += identifier[0];
         AdlName += Dm8LocatorBase.Dm8DataLocatorSeperator;

         // Module
         AdlName += "TODO";
         AdlName += Dm8LocatorBase.Dm8DataLocatorSeperator;

         // Object Name
         AdlName += identifier[1];
         AdlName += Dm8LocatorBase.Dm8DataLocatorSeperator;

         if (identifier.Count() == 3)
         {
            // Column Name
            AdlName += identifier[2];
            AdlName += Dm8LocatorBase.Dm8DataLocatorSeperator;
         }

         return AdlName;
      }

      public static void SetDm8DataLocatorType(Dm8LocatorColumn Adl ,string sqlType ,Action<Dm8LocatorColumn> SetDataTypeLength ,Action<Dm8LocatorColumn> SetPrecisionScale)
      {
         // derive internal Data Resource Locator properties
         switch (sqlType.ToLowerInvariant())
         {
            case "bit":
               Adl.DataType = Dm8DataLocatorColumnDataType.Bool;
               break;

            case "varbinary":
               Adl.DataType = Dm8DataLocatorColumnDataType.Binary;
               SetDataTypeLength(Adl);
               break;

            case "tinyint":
               Adl.DataType = Dm8DataLocatorColumnDataType.Int8;
               break;

            case "smallint":
               Adl.DataType = Dm8DataLocatorColumnDataType.Int16;
               break;

            case "int":
               Adl.DataType = Dm8DataLocatorColumnDataType.Int32;
               break;

            case "char":
               Adl.FixedLength = true;
               Adl.DataType = Dm8DataLocatorColumnDataType.Utf8;
               SetDataTypeLength(Adl);
               break;

            case "nchar":
               Adl.FixedLength = true;
               Adl.DataType = Dm8DataLocatorColumnDataType.Utf16;
               SetDataTypeLength(Adl);
               break;

            case "varchar":
               Adl.DataType = Dm8DataLocatorColumnDataType.Utf8;
               SetDataTypeLength(Adl);
               break;

            case "nvarchar":
               Adl.DataType = Dm8DataLocatorColumnDataType.Utf16;
               SetDataTypeLength(Adl);
               break;

            case "xml":
               Adl.DataType = Dm8DataLocatorColumnDataType.Utf16;
               Adl.DataTypeLength = int.MaxValue;
               break;

            case "sysname":
               Adl.DataType = Dm8DataLocatorColumnDataType.Utf16;
               Adl.DataTypeLength = 128;
               break;

            case "real":
               Adl.DataType = Dm8DataLocatorColumnDataType.Float;
               break;

            case "float":
               Adl.DataType = Dm8DataLocatorColumnDataType.Double;
               break;

            case "date":
               Adl.DataType = Dm8DataLocatorColumnDataType.Date;
               break;

            case "datetime":
               Adl.DataType = Dm8DataLocatorColumnDataType.Timestamp;
               break;

            case "smallmoney":
               Adl.DataType = Dm8DataLocatorColumnDataType.Numeric;
               Adl.DataTypePrecision = 16;
               Adl.DataTypeScale = 2;
               break;

            case "money":
               Adl.DataType = Dm8DataLocatorColumnDataType.Numeric;
               Adl.DataTypePrecision = 38;
               Adl.DataTypeScale = 2;
               break;

            case "numeric":
               Adl.DataType = Dm8DataLocatorColumnDataType.Numeric;
               SetPrecisionScale(Adl);
               break;


            default:
               throw new NotImplementedException($"TSQL Data type unknown '{sqlType}'");
         }
      }
   }
}
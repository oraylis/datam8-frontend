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
using Microsoft.SqlServer.TransactSql.ScriptDom;

namespace Dm8Locator.Db.TSql
{

   /// <summary>
   /// TSQL column specific
   /// </summary>
   /// <seealso cref="Dm8LocatorBase.Db.AdlColumn" />
   public class SqlDm8LocatorColumnProperties:IDm8LocatorSpecializedProperties
   {
      /// <summary>
      /// Initializes a new instance of the <see cref="Dm8LocatorColumn"/> class.
      /// </summary>
      public SqlDm8LocatorColumnProperties()
      {
      }


      /// <summary>
      /// Gets or sets the type of the column.
      /// </summary>
      /// <value>
      /// The type of the data.
      /// </value>
      public string OriginalDataType { get; internal set; }

      /// <summary>
      /// Gets the parameters for the column type.
      /// </summary>
      /// <value>
      /// The parameters.
      /// </value>
      public string[] OriginalDataTypeParameters { get; internal set; }

      /// <summary>
      /// Creates the type specific internal properties.
      /// </summary>
      /// <returns></returns>
      /// <exception cref="NotImplementedException">$"TSQL Data type unknown '{base.OriginalDataType}'</exception>
      public void DeriveTypeSpecificProperties(Dm8LocatorColumn Adl ,ColumnDefinition col ,short ordinal)
      {
         // read values from column
         this.OriginalDataType = col.DataType.Name.Identifiers[0].Value;
         Adl.Ordinal = ordinal;

         // get constraints
         var nullableConstraint = col.Constraints.OfType<NullableConstraintDefinition>().FirstOrDefault();
         if (nullableConstraint != null)
         {
            Adl.IsNullable = nullableConstraint.Nullable;
         }

         var defaultConstraint = col.DefaultConstraint;
         if (defaultConstraint != null)
         {
            if (defaultConstraint.Expression is Literal literal)
            {
               Adl.DefaultExpression = literal.Value;
               Adl.DefaultExpressionType = ConvertLiteralType2AdlType(literal.LiteralType);
            }

            else if (defaultConstraint.Expression is IntegerLiteral integerLiteral)
            {
               Adl.DefaultExpression = integerLiteral.Value;
            }
            else if (defaultConstraint.Expression is NumericLiteral numericLiteral)
            {
               Adl.DefaultExpression = numericLiteral.Value;
            }
         }

         // get identity
         if (col.DataType is SqlDataTypeReference dataTypeReference)
         {
            this.OriginalDataTypeParameters = dataTypeReference.Parameters.Select(p => p.Value).ToArray();
         }

         // derive internal Data Resource Locator properties
         Dm8DataLocatorDbParserBase.SetDm8DataLocatorType(Adl ,this.OriginalDataType ,this.SetDataTypeLength ,this.SetPrecisionScale);
      }

      private static Dm8DataLocatorColumnDataType ConvertLiteralType2AdlType(LiteralType literalType)
      {
         switch (literalType)
         {
            case LiteralType.Integer:
               return Dm8DataLocatorColumnDataType.Int64;
            case LiteralType.Real:
               return Dm8DataLocatorColumnDataType.Float;
            case LiteralType.Money:
               return Dm8DataLocatorColumnDataType.Numeric;
            case LiteralType.Binary:
               return Dm8DataLocatorColumnDataType.Binary;
            case LiteralType.String:
               return Dm8DataLocatorColumnDataType.Utf16;
            case LiteralType.Null:
               return Dm8DataLocatorColumnDataType.Null;
            case LiteralType.Default:
               return Dm8DataLocatorColumnDataType.Null;
            case LiteralType.Max:
               return Dm8DataLocatorColumnDataType.Null;
            case LiteralType.Odbc:
               return Dm8DataLocatorColumnDataType.Null;
            case LiteralType.Identifier:
               return Dm8DataLocatorColumnDataType.Null;
            case LiteralType.Numeric:
               return Dm8DataLocatorColumnDataType.Numeric;
            default:
               return Dm8DataLocatorColumnDataType.Null;
         }
      }

      private void SetDataTypeLength(Dm8LocatorColumn Adl)
      {
         if (this.OriginalDataTypeParameters.Length > 0)
         {
            if (int.TryParse(this.OriginalDataTypeParameters[0] ,out int value))
            {
               Adl.DataTypeLength = value;
            }
            else if (this.OriginalDataTypeParameters[0].ToLowerInvariant() == "max")
            {
               Adl.DataTypeLength = int.MaxValue;
            }
            else
            {
               throw new ArgumentException($"Wrong length '{this.OriginalDataTypeParameters[0]}' specified for '{Adl}'");
            }
         }
         else
         {
            Adl.DataTypeLength = int.MaxValue;
         }
      }

      private void SetPrecisionScale(Dm8LocatorColumn Adl)
      {
         if (this.OriginalDataTypeParameters.Length > 0)
         {
            if (int.TryParse(this.OriginalDataTypeParameters[0] ,out int value))
            {
               Adl.DataTypePrecision = value;
            }
            else if (this.OriginalDataTypeParameters[0].ToLowerInvariant() == "max")
            {
               Adl.DataTypeLength = 38;       // max for SQL Server
            }
            else
            {
               throw new ArgumentException($"Wrong scale '{this.OriginalDataTypeParameters[0]}' specified for '{Adl}'");
            }
         }
         else
         {
            Adl.DataTypeLength = 38;       // max for SQL Server
         }

         if (this.OriginalDataTypeParameters.Length > 1)
         {
            if (int.TryParse(this.OriginalDataTypeParameters[1] ,out int value))
            {
               Adl.DataTypeScale = value;
            }
            else if (this.OriginalDataTypeParameters[0].ToLowerInvariant() == "max")
            {
               Adl.DataTypeScale = 0;       // max for SQL Server
            }
            else
            {
               throw new ArgumentException($"Wrong scale '{this.OriginalDataTypeParameters[0]}' specified for '{Adl}'");
            }
         }
         else
         {
            Adl.DataTypeScale = 0;       // max for SQL Server
         }

         if (Adl.DataTypeScale > Adl.DataTypePrecision)
         {
            throw new ArgumentException($"Scale '{Adl.DataTypeScale}' is higher than precision '{Adl.DataTypePrecision}' for '{Adl}'");
         }
      }


      public string GetScript()
      {
         throw new NotImplementedException();
      }

      public string GetCompareScript()
      {
         throw new NotImplementedException();
      }
   }
}

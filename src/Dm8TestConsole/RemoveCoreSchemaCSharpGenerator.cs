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

using NJsonSchema;
using NJsonSchema.CodeGeneration;
using NJsonSchema.CodeGeneration.CSharp;

namespace Dm8Data.Helper
{
   public class RemoveCoreSchemaCSharpGenerator:CSharpGenerator

   {
      public RemoveCoreSchemaCSharpGenerator(object rootObject ,CSharpGeneratorSettings cSharpGeneratorSettings) : base(rootObject ,cSharpGeneratorSettings)
      {
      }

      protected override CodeArtifact GenerateType(JsonSchema schema ,string typeNameHint)
      {
         var rc = base.GenerateType(schema ,typeNameHint);
         if (schema.ParentSchema != null &&
             schema.ParentSchema.Id == "https://aut0sto0dev.blob.core.windows.net/$web/Core.ModelEntry.Schema.json")
         {
            rc = new CodeArtifact(rc.TypeName ,rc.Type ,rc.Language ,rc.Category ,"");

         }
         return rc;
      }
   }

}

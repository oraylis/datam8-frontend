using NJsonSchema;
using NJsonSchema.CodeGeneration;
using NJsonSchema.CodeGeneration.CSharp;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Dm8Data.Helper
{
    public class RemoveCoreSchemaCSharpGenerator : CSharpGenerator

    {
        public RemoveCoreSchemaCSharpGenerator(object rootObject, CSharpGeneratorSettings cSharpGeneratorSettings) : base(rootObject, cSharpGeneratorSettings)
        {
        }

        protected override CodeArtifact GenerateType(JsonSchema schema, string typeNameHint)
        {
            var rc = base.GenerateType(schema, typeNameHint);
            if (schema.ParentSchema != null &&
                schema.ParentSchema.Id == "https://aut0sto0dev.blob.core.windows.net/$web/Core.ModelEntry.Schema.json")
            {
                rc = new CodeArtifact(rc.TypeName, rc.Type, rc.Language, rc.Category, "");

            }
            return rc;
        }
    }

}

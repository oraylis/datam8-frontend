using System;
using System.IO;
using Microsoft.Build.Framework;
using Microsoft.Build.Utilities;
using NJsonSchema;
using NJsonSchema.CodeGeneration.CSharp;

namespace Dm8Build
{

    public class GenerateCodeTask : Task
    {
        [Required]
        public string JsonSchemaPath { get; set; }

        [Required]
        public string OutputPath { get; set; }

        [Output]
        public string Output { get; set; }

        private JsonSchema removeExternalReference(JsonSchema schema)
        {
            foreach (var p in schema.ActualProperties)
            {
                if (p.Value.HasReference)
                {
                    Log.LogMessage(MessageImportance.High, p.Value.ToJson());
                    schema.Properties.Remove(p.Key);
                }
            }

            return schema;
        }

        public override bool Execute()
        {
            Log.LogMessage(MessageImportance.High, "Generating class from " + JsonSchemaPath);
            Output = JsonSchemaPath;

            // var licenseText = File.ReadAllText("license.txt");
            // Console.WriteLine(licenseText);
            var success = true;
            var files = Directory.GetFiles(JsonSchemaPath);
            Directory.CreateDirectory(OutputPath);

            foreach (var f in files)
            {
                string code = "";
                var fileContent = File.ReadAllText(f);

                try
                {
                    var schema = JsonSchema.FromFileAsync(f).Result;
                    // TODO: remove or replace with simple object?
                    // printSchema(schema, 0);
                    // schema = removeExternalReference(schema);

                    var outputPath = Path.Combine(OutputPath, $"{schema.Title}.cs");
                    var generator = new CSharpGenerator(schema, new CSharpGeneratorSettings
                    {
                        Namespace = "Dm8Data",
                        GenerateDataAnnotations = true,
                        ClassStyle = CSharpClassStyle.Prism,
                        ExcludedTypeNames = new string[] { "DataType" },
                    });

                    code = generator.GenerateFile();

                    File.Delete(path: outputPath);
                    File.WriteAllText(path: outputPath, contents: code);

                    Log.LogMessage(MessageImportance.High, "Generated file: " + f);
                }
                catch (Exception err)
                {
                    Log.LogError($"Error generating file\n{f}\n{err}");
                    success = false;
                }
            }

            Log.LogMessage(
                MessageImportance.High,
                "Finished generating classes from json schema."
            );

            return success;
        }
    }
}

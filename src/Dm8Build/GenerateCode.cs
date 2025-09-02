using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Collections.Generic;
using Microsoft.Build.Framework;
using Microsoft.Build.Utilities;
using Newtonsoft.Json;
using NJsonSchema;
using NJsonSchema.CodeGeneration.CSharp;

namespace Dm8Build
{

    public class GenerateCodeTask : Task
    {
        [Required]
        public string JsonSchemaPath { get; set; }

        [Required]
        public string OutputAssemblyName { get; set; }

        [Required]
        public string OutputPath { get; set; }

        [Output]
        public string Output { get; set; }


        public override bool Execute()
        {
            Log.LogMessage(MessageImportance.High, "Generating class from " + JsonSchemaPath);
            Output = JsonSchemaPath;

            var licenseText = getLicenseText();
            var success = true;
            var files = Directory.GetFiles(JsonSchemaPath);
            Directory.CreateDirectory(OutputPath);

            foreach (var f in files) //.Where(file => file.EndsWith("model.json")))
            {
                string code = "";
                var fileName = f.Split('\\').Last();

                try
                {
                    var schema = JsonSchema.FromFileAsync(f).Result;
                    var externalTitles = removeExternalReference(schema, false, fileName);

                    // special case, since the json resolver "swallows" the
                    // external reference so it is not possible(?) to detect
                    // that PropertyReference is an external ref 
                    if (fileName != "property.json")
                    {
                        externalTitles.Add("PropertyReference");
                    }

                    var outputPath = Path.Combine(OutputPath, $"{schema.Title}.cs");
                    var generator = new CSharpGenerator(schema, new CSharpGeneratorSettings
                    {
                        Namespace = OutputAssemblyName,
                        GenerateDataAnnotations = true,
                        ClassStyle = CSharpClassStyle.Prism,
                        ExcludedTypeNames = externalTitles.Distinct().ToArray(),
                    });

                    code = licenseText + generator.GenerateFile();

                    // the CSharpGenerator generates lf lineendings, probably because
                    // the json files habe them, which then clashes with the .editorconfig
                    // setting and license file.
                    // Align line endinge (dos -> unix -> dos)
                    code = code.Replace("\r\n", "\n").Replace("\n", "\r\n");

                    File.Delete(path: outputPath);
                    File.WriteAllText(path: outputPath, contents: code);

                    Log.LogMessage(
                        MessageImportance.High,
                        "Generated file " + fileName + " with " + externalTitles.Count + " external references."
                    );
                    Log.LogMessage(
                        MessageImportance.Normal,
                        "ExternalRefs(" + externalTitles.Count + "): " +
                        string.Join(", ", externalTitles.Distinct().ToArray())
                    );
                }
                catch (Exception err)
                {
                    Log.LogError($"Error generating file: {fileName}\n{err}");
                    success = false;
                }
            }

            Log.LogMessage(
                MessageImportance.High,
                "Finished generating classes from json schema."
            );

            return success;
        }

        private string getLicenseText()
        {

            var name = Assembly.GetExecutingAssembly().GetName().Name;
            var stream = Assembly
              .GetExecutingAssembly()
              .GetManifestResourceStream($"{name}.Embedded.license.txt");
            var streamReader = new StreamReader(stream, System.Text.Encoding.UTF8);

            var licenseText = streamReader.ReadToEnd();

            streamReader.Close();
            stream.Close();

            return licenseText;
        }

        private List<string> removeExternalReference(
            JsonSchema schema, bool isExternal, string title
            )
        {
            var foundExternalTypes = new List<string>();

            foreach (var p in schema.Properties)
            {
                if (p.Value.IsArray)
                {
                    foundExternalTypes.AddRange(
                        removeExternalReference(p.Value.ActualSchema, false, "")
                    );
                }
                if (p.Value.DocumentPath != null)
                {
                    foundExternalTypes.AddRange(
                        removeExternalReference(p.Value.ActualSchema, true, p.Value.Title)
                    );
                    foundExternalTypes.Add(p.Value.Title);
                    foundExternalTypes.Add(p.Key);
                }
                if (isExternal && (p.Value.IsObject || p.Value.IsEnumeration))
                {
                    var firstLetter = char.ToUpper(p.Key[0]);
                    foundExternalTypes.Add(
                        title + firstLetter + p.Key.Substring(1)
                    );
                    if (p.Value.HasTypeNameTitle)
                    {
                        firstLetter = char.ToUpper(p.Value.Title[0]);
                        foundExternalTypes.Add(
                            title + firstLetter + p.Value.Title.Substring(1)
                        );
                    }
                }
            }

            foreach (var d in schema.Definitions)
            {
                if (d.Value.DocumentPath != null || isExternal)
                {
                    foundExternalTypes.AddRange(
                        removeExternalReference(d.Value.ActualSchema, true, d.Key)
                    );
                    foundExternalTypes.Add(d.Value.Title);
                    foundExternalTypes.Add(d.Key);
                }
            }

            return foundExternalTypes;
        }
    }
}

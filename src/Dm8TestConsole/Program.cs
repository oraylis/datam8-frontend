﻿/* DataM8
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

using Newtonsoft.Json;
using NJsonSchema.CodeGeneration.CSharp;
using NJsonSchema.Generation;
using NJsonSchema;
using Newtonsoft.Json.Schema;
using Dm8Data.Helper;


try
{
    string path = "P:\\Develop\\dm8\\automation\\DataM8\\Dm8Data\\Model\\";
    string schemaJson = File.ReadAllText(path + "\\..\\Json\\CuratedModelEntry.json");
    string coreSchemaJson = File.ReadAllText(path + "\\..\\Json\\Core.ModelEntry.Schema.json");

    NJsonSchema.JsonSchema coreSchema = NJsonSchema.JsonSchema.FromJsonAsync(coreSchemaJson).Result;
    coreSchema.Id = "https://aut0sto0dev.blob.core.windows.net/$web/Core.ModelEntry.Schema.json";
    Func<NJsonSchema.JsonSchema, JsonReferenceResolver> referenceResolverFactory = x =>
    {
        NJsonSchema.Generation.JsonSchemaResolver schemaResolver = new NJsonSchema.Generation.JsonSchemaResolver(x, new NJsonSchema.NewtonsoftJson.Generation.NewtonsoftJsonSchemaGeneratorSettings());
        JsonReferenceResolver referenceResolver = new JsonReferenceResolver(schemaResolver);
        referenceResolver.AddDocumentReference("https://aut0sto0dev.blob.core.windows.net/$web/Core.ModelEntry.Schema.json", coreSchema);

        return referenceResolver;
    };

    var schema = NJsonSchema.JsonSchema.FromJsonAsync(schemaJson, path, referenceResolverFactory).Result;
    var generator = new RemoveCoreSchemaCSharpGenerator(schema, new CSharpGeneratorSettings
    {
        Namespace = "Dm8Data.Curated",
        GenerateDataAnnotations = true,
        ClassStyle = CSharpClassStyle.Prism,
        GenerateOptionalPropertiesAsNullable = true,
        HandleReferences = false,
        ArrayBaseType = "System.Collections.ObjectModel.ObservableCollection",
        ArrayType = "System.Collections.ObjectModel.ObservableCollection"
    });
    var file = generator.GenerateFile("ModelEntry");
    file = "// Generated by DataM8\n" + file;
    file = file.Replace("<Source>", "<Dm8Data.Core.SourceEntity>");
    file = file.Replace(" Entity ", " Dm8Data.Core.CoreEntity ");
   Console.WriteLine(file);
}
catch (Exception ex)
{
    Console.WriteLine("// Exception " + ex.Message);
    Console.WriteLine("/* Details:");
    Console.WriteLine(ex.ToString());
    Console.WriteLine("*/");
}
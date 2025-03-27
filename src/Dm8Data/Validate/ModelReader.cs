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

using Dm8Data.Helper;
using Dm8Data.Validate.Exceptions;
using Dm8Data.Validate.Generic;
using Newtonsoft.Json;
using NJsonSchema;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;

namespace Dm8Data.Validate
{
    public abstract class ModelReader<TObj> : IModelReader<TObj>
        where TObj : class, new()
    {
        #region Property Schema
        public string Schema
        {
            get => this.schema;
            protected set => this.schema = value;
        }

        public string schema;
        #endregion

        #region Property SchemaResolver
        public Func<NJsonSchema.JsonSchema, JsonReferenceResolver> SchemaResolver
        {
            get => this.schemaResolver;
            protected set => this.schemaResolver = value;
        }

        public Func<NJsonSchema.JsonSchema, JsonReferenceResolver> schemaResolver;
        #endregion


        protected ModelReader()
        {
            try
            {
                string name = $"{typeof(TObj).ToString().Replace("Dm8Data", "Dm8Data.Json")}.Schema.json";
                using (var schema = Assembly.GetAssembly(typeof(Dm8Data.Properties.Resources))
                           .GetManifestResourceStream(name))
                {
                    using (var rdr = new StreamReader(schema))
                    {
                        this.Schema = rdr.ReadToEnd();
                    }
                }
                this.SchemaResolver = this.CreateSchemaResolver();
            }
            catch
            {
                this.Schema = null;
            }
        }



        public virtual async Task<TObj> ReadFromFileAsync(string fileName)
        {
            string json = await FileHelper.ReadFileAsync(fileName);
            return await ((IModelReader<TObj>)this).ReadFromStringAsync(json);
        }

        public virtual async Task<TObj> ReadFromStringAsync(string json)
        {
            TObj item = null;
            var validateExceptions = await this.ValidateSchemaFromStringAsync(json);
            if (validateExceptions != null && validateExceptions.Count() > 0)
            {
                throw new AggregateException(validateExceptions);
            }
            await Task.Factory.StartNew(() =>
            {
                // validate if JSON is valid
                item = JsonConvert.DeserializeObject<TObj>(json);
            });
            return item;
        }

        public virtual async Task<IEnumerable<SchemaValidateException>> ValidateSchemaFromFileAsync(string fileName)
        {
            string json = await FileHelper.ReadFileAsync(fileName);
            return await this.ValidateSchemaFromStringAsync(json);
        }

        public virtual async Task<IEnumerable<SchemaValidateException>> ValidateSchemaFromStringAsync(string json)
        {
            if (this.Schema == null)
                return new List<SchemaValidateException>();

            var jsonSchema = await NJsonSchema.JsonSchema.FromJsonAsync(this.Schema, Assembly.GetExecutingAssembly().Location, this.SchemaResolver);
            var rc = new List<SchemaValidateException>();
            foreach (var error in jsonSchema.Validate(json))
            {
                rc.Add(new SchemaValidateException(error.ToString(), error.LineNumber, error.LinePosition, "Unknown"));
            }

            return rc;
        }

        private Func<NJsonSchema.JsonSchema, JsonReferenceResolver> CreateSchemaResolver()
        {
            try
            {
                string name = $"Dm8Data.Json.Core.ModelEntry.Schema.json";
                using (var schema = Assembly.GetAssembly(typeof(Dm8Data.Properties.Resources))
                           .GetManifestResourceStream(name))
                {
                    using (var rdr = new StreamReader(schema))
                    {
                        string coreSchemaJson = rdr.ReadToEnd();
                        NJsonSchema.JsonSchema coreSchema = NJsonSchema.JsonSchema.FromJsonAsync(coreSchemaJson).Result;
                        coreSchema.Id = "https://aut0sto0dev.blob.core.windows.net/$web/Core.ModelEntry.Schema.json";
                        Func<NJsonSchema.JsonSchema, JsonReferenceResolver> referenceResolverFactory = x =>
                        {
                            NJsonSchema.Generation.JsonSchemaResolver schemaResolver = new NJsonSchema.Generation.JsonSchemaResolver(x, new NJsonSchema.NewtonsoftJson.Generation.NewtonsoftJsonSchemaGeneratorSettings());
                            JsonReferenceResolver referenceResolver = new JsonReferenceResolver(schemaResolver);
                            referenceResolver.AddDocumentReference("https://aut0sto0dev.blob.core.windows.net/$web/Core.ModelEntry.Schema.json", coreSchema);

                            return referenceResolver;
                        };

                        return referenceResolverFactory;
                    }
                }
            }
            catch
            {
                this.Schema = null;
            }
            return null;
        }

        public virtual Task<IEnumerable<ModelReaderException>> ValidateObjectAsync(SolutionHelper solutionHelper, TObj o)
        {
            throw new NotImplementedException();
        }

        async Task<object> Base.IModelReader.ReadFromFileAsync(string fileName)
        {
            return await ((IModelReader<TObj>)this).ReadFromFileAsync(fileName);
        }

        async Task<object> Base.IModelReader.ReadFromStringAsync(string json)
        {
            return await ((IModelReader<TObj>)this).ReadFromStringAsync(json);
        }

        Task<IEnumerable<ModelReaderException>> Base.IModelReader.ValidateObjectAsync(SolutionHelper solutionHelper, object o)
        {
            return ((IModelReader<TObj>)this).ValidateObjectAsync(solutionHelper, o as TObj);
        }
    }
}

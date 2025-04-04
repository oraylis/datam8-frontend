using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace Dm8Locator
{
    /// <summary>
    /// JSon converter for all types of data resource locators contained in the current assembly
    /// </summary>
    /// <seealso cref="System.Text.Json.Serialization.JsonConverter{DataRecource.Adl}" />
    public class Dm8DataLocatorJsonConverter : JsonConverter<Dm8LocatorBase>
    {
        /// <summary>
        /// The Adl type dictionary
        /// </summary>
        private Dictionary<string, Type> Dm8DataLocatorTypeDictionary;

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8DataLocatorJsonConverter"/> class.
        /// All types contained in the executing assembly are added to the Adl type dictionary.
        /// </summary>
        public Dm8DataLocatorJsonConverter()
        {
            this.Dm8DataLocatorTypeDictionary = new Dictionary<string, Type>();
            this.AddAssembly(Assembly.GetExecutingAssembly());
        }

        /// <summary>
        /// Add all types of the specified assembly to the Adl type dictionary.
        /// </summary>
        /// <param name="assembly">The assembly.</param>
        public void AddAssembly(Assembly assembly)
        {
            foreach(var t in assembly.GetTypes().Where(t => t.IsAssignableTo(typeof(Dm8LocatorBase)) && t != typeof(Dm8LocatorBase)))
            {
                this.Dm8DataLocatorTypeDictionary.Add(t.Name, t);
            }
        }

        /// <summary>
        /// Determines if the given type is contained in the type dictionary.
        /// </summary>
        /// <param name="typeToConvert">The type to compare against.</param>
        /// <returns>
        ///   <see langword="true" /> if the type can be converted; otherwise, <see langword="false" />.
        /// </returns>
        public override bool CanConvert(Type typeToConvert)
        {
            // converter for unspecified Adl
            return typeToConvert == typeof(Dm8LocatorBase); 
        }

        /// <summary>
        /// Reads and converts the JSON to type <typeparamref name="T" />.
        /// The property $type is used to determine the type of object to be deserialized.
        /// </summary> 
        /// <param name="reader">The reader.</param>
        /// <param name="typeToConvert">The type to convert.</param>
        /// <param name="options">An object that specifies serialization options to use.</param>
        /// <returns>
        /// The converted value.
        /// </returns>
        public override Dm8LocatorBase Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            Utf8JsonReader subReader = reader;
            while (subReader.Read())
            {
                switch (subReader.TokenType)
                {
                    case JsonTokenType.PropertyName:
                        {
                            var text = subReader.GetString();
                            if (text == "$type")
                            {
                                subReader.Read();
                                var typeName = subReader.GetString();
                                var type = this.Dm8DataLocatorTypeDictionary[typeName];
                                return (Dm8LocatorBase) JsonSerializer.Deserialize(ref reader, type);
                            }
                            break;
                        }
                }
            }
            return null;
        }

        /// <summary>
        /// Writes a specified value as JSON.
        /// Use base implementation to serialize object
        /// </summary>
        /// <param name="writer">The writer to write to.</param>
        /// <param name="value">The value to convert to JSON.</param>
        /// <param name="options">An object that specifies serialization options to use.</param>
        public override void Write(Utf8JsonWriter writer, Dm8LocatorBase value, JsonSerializerOptions options)
        {
            JsonSerializer.Serialize(writer, value, value.GetType(), options);
        }
    }
}

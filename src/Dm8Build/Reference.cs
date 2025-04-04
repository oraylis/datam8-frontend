using System;
using NJsonSchema.CodeGeneration;
using NJsonSchema.CodeGeneration.CSharp;
using System.Runtime.CompilerServices;

namespace Dm8Base
{
    public class Reference
    {
        // endure library is referenced
        #pragma warning disable IDE0052 // Remove unread private members
        readonly static CSharpGenerator CSharpGenerator = new CSharpGenerator("");
        #pragma warning restore IDE0052 // Remove unread private members

        public static void Main()
        {
            var t = typeof(System.Runtime.CompilerServices.Unsafe);
            var generator = new CSharpGenerator("", new CSharpGeneratorSettings { Namespace = "Dm8Data.AttributeTypes", GenerateDataAnnotations = true, ClassStyle = CSharpClassStyle.Prism, GenerateNullableReferenceTypes = true});
        }
    }
}

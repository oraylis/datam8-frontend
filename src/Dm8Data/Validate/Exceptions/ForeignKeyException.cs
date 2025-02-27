using System;
using Dm8Data.Helper;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Collections;

namespace Dm8Data.Validate.Exceptions
{
    public class ForeignKeyException : ModelReaderException
    {
        public const string MessageFormat = "Foreign-Key field used in {0} does not exist in {1}: {2}";

        private readonly Core.RelationshipField relationshipField;

        private readonly string fieldName;

        private readonly Core.CoreEntity entity;

        public ForeignKeyException(Core.RelationshipField relationshipField, Core.CoreEntity entity, string fieldName)
        {
            this.Code = "F002";
            this.relationshipField = relationshipField;
            this.entity = entity;
            this.fieldName = fieldName;
        }

        public override string Message
        { 
            get
            {
                return string.Format(MessageFormat, this.relationshipField.Dm8lAttr, this.entity.Dm8l, this.fieldName);
            } 
        }

        public override string Source
        {
            get => $"ForeignKey Error: {this.relationshipField.Dm8lAttr}";
        }

    }
}

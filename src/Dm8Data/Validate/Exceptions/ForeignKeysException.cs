using System;
using Dm8Data.Helper;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Collections;
using Dm8Locator.Dm8l;

namespace Dm8Data.Validate.Exceptions
{
    public class ForeignKeysException : ModelReaderException
    {
        public const string MessageFormat = "Foreign-Key fields {0} [{1}] does not match with {2} [{3}]";


        private readonly Core.Relationship relationship;

        private readonly Core.CoreEntity foreignCoreEntity;

        private readonly Core.CoreEntity primaryCoreEntity;


        public ForeignKeysException(Core.Relationship relationship, Core.CoreEntity foreignCoreEntity, Core.CoreEntity primaryCoreEntity)
        {
            this.Code = "F001";
            this.relationship = relationship;
            this.foreignCoreEntity = foreignCoreEntity;
            this.primaryCoreEntity = primaryCoreEntity;
        }

        public override string Message
        { 
            get
            {
                var primaryModelAttrs = primaryCoreEntity.Attribute
                    .Where(attr => attr.BusinessKeyNo != null);

                return string.Format(MessageFormat, foreignCoreEntity.Dm8l, relationship.Fields.Select(f => new Dm8lAttribute(f.Dm8lAttr).Name).ToCommaList(), primaryCoreEntity.Dm8l, primaryModelAttrs.Select(attr => attr.Name).ToCommaList());
            } 
        }

        public override string Source
        {
            get => $"ForeignKeys Error: {this.relationship.Dm8lKey} ({this.relationship.Role})";
        }


    }
}

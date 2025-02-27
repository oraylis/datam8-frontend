using Dm8Data.Helper;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;
using Dm8Data.DataTypes;
using Dm8Data.Generic;
using Dm8Data.Validate.Exceptions;
using Dm8Locator.Dm8l;

namespace Dm8Data.Validate
{
    public class ValidateForeignKey
    {
        public static async Task<IEnumerable<ModelReaderException>> ValidateAsync(Core.ModelEntry foreignModelEntry, Func<Dm8lEntity, Task<Core.CoreEntity>> readerFunc)
        {
            return await Validate(foreignModelEntry.Entity, readerFunc);
        }

        public static async Task<IEnumerable<ModelReaderException>> ValidateAsync(Curated.ModelEntry foreignModelEntry, Func<Dm8lEntity, Task<Core.CoreEntity>> readerFunc)
        {
            return await Validate(foreignModelEntry.Entity, readerFunc);
        }

        private static async Task<IEnumerable<ModelReaderException>> Validate(Core.CoreEntity foreignEntity, Func<Dm8lEntity, Task<Core.CoreEntity>> readerFunc)
        {
            var rc = new List<ModelReaderException>();
            if (foreignEntity.Relationship == null)
                return rc;

            foreach (var relationship in foreignEntity.Relationship)
            {
                try
                {
                    var primaryEntity = await readerFunc(new Dm8lEntity(relationship.Dm8lKey));
                    var primaryAttrs = primaryEntity.Attribute
                        .Where(attr => attr.BusinessKeyNo != null).ToList();
                    if (primaryAttrs.Count() != relationship.Fields.Count())
                        rc.Add(new ForeignKeysException(relationship, primaryEntity, foreignEntity));

                    foreach (var relationshipField in relationship.Fields)
                    {
                        if (relationshipField.Dm8lAttr == null)
                        {
                            rc.Add(new ForeignKeyException(relationshipField, foreignEntity, "(not defined)"));
                            continue;
                        }
                        var attr = new Dm8lAttribute(relationshipField.Dm8lAttr);
                        if (!foreignEntity.Attribute.Any(a => a.Name == attr.Name))
                            rc.Add(new ForeignKeyException(relationshipField, foreignEntity, attr.Name));

                        var attrKey = new Dm8lAttribute(relationshipField.Dm8lKeyAttr);
                        if (!primaryEntity.Attribute.Any(a => a.Name == attrKey.Name))
                            rc.Add(new ForeignKeyException(relationshipField, primaryEntity, attrKey.Name));
                    }
                }
                catch (Exception ex)
                {
                    rc.Add(new UnknownValidateException(ex, "Unknown"));
                }
            }

            return rc;
        }

    }

}


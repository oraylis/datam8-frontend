using Dm8Data.Helper;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;
using Dm8Data.Validate.Exceptions;

namespace Dm8Data.Validate
{
    public class ValidateUniqueness<TObj>
    {
        struct Entry
        {
            public List<string> vals;
            public List<TObj> objs;
        };

        public static async Task<IEnumerable<ModelReaderException>> ValidateAsync(IEnumerable<TObj> list, params Expression<Func<TObj, string>>[] fieldGetter)
        {
            var rc = new List<ModelReaderException>();
            try
            {
                await Task.Factory.StartNew(() =>
                {
                    var fieldGetterFunc = new List<Func<TObj, string>>();
                    foreach (var f in fieldGetter)
                    {
                        fieldGetterFunc.Add(f.Compile());
                    }

                    var uniqueHash = new Dictionary<string, Entry>();
                    var uniqueError = new List<string>();
                    foreach (var item in list)
                    {
                        if (item == null)
                            continue;
                        var vals = new List<string>();
                        foreach (var f in fieldGetterFunc)
                        {
                            vals.Add(f(item));
                        }
                        var key = vals.ToSeparatorList("$");
                        if (uniqueHash.ContainsKey(key))
                        {
                            uniqueError.Add(key);
                            uniqueHash[key].objs.Add(item);
                        }
                        else
                        {
                            var objs = new List<TObj>
                            {
                                item
                            };

                            uniqueHash.Add(key, new Entry { vals = vals, objs = objs });
                        }
                    }

                    var names = fieldGetter.Select(f => ValidateHelper.GetPropertyName(f)).ToList();

                    foreach (var e in uniqueError)
                    {
                        rc.Add(new UniqueExpressionException { FieldList = names, ValueList = uniqueHash[e].vals, ObjectList = uniqueHash[e].objs });
                    }

                });
            }
            catch (Exception ex)
            {
                rc.Add(new UnknownValidateException(ex, "Unknown"));
            }
            return rc;
        }
    }
}

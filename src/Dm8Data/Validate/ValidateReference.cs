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

namespace Dm8Data.Validate
{
    public class ValidateReference<TMainObj, TRefObj>
            where TMainObj : class, new()
            where TRefObj : class, new()
    {
        public static async Task<IEnumerable<ModelReaderException>> ValidateListAsync(string adl, IEnumerable<TMainObj> list, List<TRefObj> refList, params Expression<Func<TMainObj, TRefObj, Tuple<string, string>>>[] fieldGetter)
        {
            var rc = new List<ModelReaderException>();
            try
            {
                // get list of referenced objects
                var fieldGetterFunc = fieldGetter.Select(
                      f => new Tuple<Func<TMainObj, TRefObj, Tuple<string, string>>, Expression<Func<TMainObj, TRefObj, Tuple<string, string>>>>(f.Compile(), f)
                    ).ToList();

                await Task.Factory.StartNew(() =>
                {
                    var refItems = refList.ToList();
                    foreach (var item in list)
                    {
                        var refObjectFound = true;
                        var fieldNames = new List<Tuple<string, string>>();
                        var fieldValues = new List<string>();
                        var firstItem = true;
                        foreach (var refItem in refItems)
                        {
                            // get fields
                            refObjectFound = true;
                            foreach (var field in fieldGetterFunc)
                            {
                                var vals = field.Item1.Invoke(item, refItem);
                                if (vals.Item1 != vals.Item2)
                                {
                                    refObjectFound = false;                                    
                                }
                                if (firstItem)
                                {
                                    fieldNames.Add(ValidateHelper.GetReferenceNames(field.Item2));
                                    fieldValues.Add(vals.Item1);
                                }
                            }
                            firstItem = false;
                            if (refObjectFound)
                                break;
                        }

                        if (!refObjectFound)
                        {
                            dynamic itemDyn = item;
                            Type typeOfDynamic = itemDyn.GetType();
                            bool exist = typeOfDynamic.GetProperties().Any(p => p.Name.Equals("Name"));
                            var name = exist ? "/" + itemDyn.Name : string.Empty;
                            rc.Add(new ReferenceException { Adl = adl, SourceObject = typeof(TMainObj).Name + name, TargetObject = typeof(TRefObj).Name, FieldNames = fieldNames, ValueList = fieldValues });
                        }
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

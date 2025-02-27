using Newtonsoft.Json;
using Oracle.ManagedDataAccess.Client;
using System;
using System.Collections.Generic;
using System.Data;
using System.Globalization;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;

namespace Dm8PluginBase.Extensions
{
    public static class Extensions
    {
        public static int? GetInt(this DataRow row, string colName)
        {
            var objVal = row[colName];
            if (objVal is DBNull)
                return null;
            if (objVal is byte int8)
                return Convert.ToInt32(int8);
            if (objVal is Int16 int16)
                return Convert.ToInt32(int16);
            if (objVal is Int32 int32)
                return Convert.ToInt32(int32);
            if (objVal is Int64 int64)
                return Convert.ToInt32(int64);
            if (objVal is Decimal intDecimal)
                return Convert.ToInt32(intDecimal);
            throw new Exception($"Cannot convert column {colName} to data type int");
        }

        public static T? ConvertClass<T, U>(U source)
        {
            string tmpStr = JsonConvert.SerializeObject(source, Formatting.None, new JsonSerializerSettings()
            {
                NullValueHandling = NullValueHandling.Ignore
            });
            var x = JsonConvert.DeserializeObject<T>(tmpStr);

            //PropertyInfo[] ps = source.GetType().GetProperties();
            //foreach (PropertyInfo p in ps)
            //{
            //}



            return x;
        }

        public static List<string> GetFriendlyNames(this Enum enm)
        {
            List<string> result = new List<string>();
            result.AddRange(Enum.GetNames(enm.GetType()).Select(s => s.ToFriendlyName()));
            return result;
        }
        public static T ToEnum<T>(this string value)
        {
            return (T)Enum.Parse(typeof(T), value, true);
        }

        public static string? GetFriendlyName(this Enum enm)
        {
            return Enum.GetName(enm.GetType(), enm)?.ToFriendlyName();
        }

        private static string ToFriendlyName(this string orig)
        {
            return orig.Replace("_", " ");
        }
        public static string FromCamelCase(this string orig)
        {
            string retVal = "";
            bool lastIsUpper = false;
            for (int i = 0; i < orig.Length; i++)
            {
                string part = orig.Substring(i, 1);

                if (part.Equals(part.ToUpper()))
                {
                    if (!lastIsUpper)
                    {
                        lastIsUpper = true;
                        if (!retVal.Equals(retVal.ToLower()))
                        {
                            retVal += " ";
                        }
                    }
                }
                else
                {
                    lastIsUpper = false;
                }
                retVal += part;
            }
            return (retVal.Trim());
        }
        public static void SetVersion(this OracleConnection con, OracleAllowedLogonVersionClient version)
        {
            try
            {
                con.SqlNetAllowedLogonVersionClient = version;
            }
            catch { }
        }
    }
}

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

using System;
using System.IO;
using System.Threading.Tasks;
using Newtonsoft.Json;

namespace Dm8Data.Helper
{
#pragma warning disable CA2200 // Rethrow to preserve stack details
   public class FileHelper
   {
      static bool IsFileInUse(string path)
      {
         try
         {
            using (FileStream fs = new FileStream(path ,FileMode.Open))
            {
               return !fs.CanRead;
            }
         } catch (IOException)
         {
            return true;
         }
      }

      public static async Task<string> ReadFileAsync(string filePath ,bool tryOnlyOnceIfNotExists = false)
      {
         Exception exception = null;
         for (int i = 0; i < 10; i++)
         {
            try
            {
               return await File.ReadAllTextAsync(filePath);
            } catch (FileNotFoundException ex1)
            {
               if (tryOnlyOnceIfNotExists)
               {
#pragma warning disable CA2200 // Rethrow to preserve stack details
                  throw ex1;
#pragma warning restore CA2200 // Rethrow to preserve stack details
               } else
               {
                  System.Threading.Thread.Sleep(250);
                  exception = ex1;
               }
            } catch (IOException ex)
            {
               System.Threading.Thread.Sleep(250);
               exception = ex;
            }
         }

         throw exception;
      }

      public static async Task WriteFileAsync(string filePath ,string content)
      {
         Exception exception = null;
         for (int i = 0; i < 10; i++)
         {
            try
            {
               if (!Directory.Exists(Path.GetDirectoryName(filePath)))
               {
                  Directory.CreateDirectory(Path.GetDirectoryName(filePath));
               }

               await File.WriteAllTextAsync(filePath ,content);
               while (IsFileInUse(filePath))
               {
                  System.Threading.Thread.Sleep(100);
               }
               return;
            } catch (IOException ex)
            {
               System.Threading.Thread.Sleep(1000);
               exception = ex;
            }
         }

         throw exception;
      }
      public static bool IsBinary(string filePath)
      {
         const int charsToCheck = 8000;
         const char nulChar = '\0';
         using var streamReader = new StreamReader(filePath);
         for (var i = 0; i < charsToCheck; i++)
         {
            if (streamReader.EndOfStream)
            {
               return false;
            }

            if ((char)streamReader.Read() == nulChar)
            {

               return (true);
            }
         }
         return (false);
      }

      public static string MakeJson(object obj)
      {
         var settings = new JsonSerializerSettings
         {
            NullValueHandling = NullValueHandling.Ignore ,
            ContractResolver = new DefaultContractResolver
            {
               NamingStrategy = new CamelCaseNamingStrategy
               {
                  ProcessDictionaryKeys = true ,
                  OverrideSpecifiedNames = false
               }
            } ,
            Converters =
            {
               new StringEnumConverter(new CamelCaseNamingStrategy(), allowIntegerValues: false)
            }
         };

         string retVal = JsonConvert.SerializeObject(obj ,Formatting.Indented ,settings);

         return (retVal);
      }
   }
}

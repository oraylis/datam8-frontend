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

using System.Collections.ObjectModel;
using System.Linq;
using Dm8Data;
using Dm8Data.AttributeTypes;
using Dm8Data.Helper;
using Newtonsoft.Json;

namespace Dm8Main.Updates
{
   public class CheckDefaultEntries
   {
      public static ObservableCollection<AttributeType> AttributTypes(ObservableCollection<AttributeType> attributeTypes ,out bool found)
      {
         found = attributeTypes.Any(x => x.IsDefaultProperty == true);

         if (!found)
         {
            attributeTypes.Add(new AttributeType
            {
               Name = "Generic String" ,
               DisplayName = "Generic for String" ,
               DefaultType = "string" ,
               CanBeInRelation = false ,
               IsDefaultProperty = true
            });
            attributeTypes.Add(new AttributeType
            {
               Name = "Generic Datetime" ,
               DisplayName = "Generic for Datetime" ,
               DefaultType = "datetime" ,
               CanBeInRelation = false ,
               IsDefaultProperty = true
            });
            attributeTypes.Add(new AttributeType
            {
               Name = "Generic Date" ,
               DisplayName = "Generic for Date" ,
               DefaultType = "date" ,
               CanBeInRelation = false ,
               IsDefaultProperty = true
            });
            attributeTypes.Add(new AttributeType
            {
               Name = "Generic Int" ,
               DisplayName = "Generic for Int" ,
               DefaultType = "int" ,
               CanBeInRelation = true ,
               IsDefaultProperty = true
            });
            attributeTypes.Add(new AttributeType
            {
               Name = "Generic Double" ,
               DisplayName = "Generic for Double" ,
               DefaultType = "double" ,
               CanBeInRelation = false ,
               IsDefaultProperty = true
            });

         }
         return (attributeTypes);
      }

      public static Dm8Data.Solution Solution(string content ,ref bool reWriteFile)
      {
         Dm8Data.Solution solution = new Solution();

         bool loop = true;
         while (loop)
         {
            try
            {
               solution = JsonConvert.DeserializeObject<Dm8Data.Solution>(content);
               loop = false;
            } catch
            {
               Solution s = new Solution();
               content = FileHelper.MakeJson(s);
               reWriteFile = true;
               //string v = ex.Message;
               //if (v.Contains("AreaTypes"))
               //{
               //    int pos = content.LastIndexOf("}", StringComparison.InvariantCultureIgnoreCase);
               //    content = content.Substring(0, pos)
               //             + ",AreaTypes: {Raw: \"Raw\",Stage: \"Stage\",Core: \"Core\",Curated: \"Curated\",Diagram: \"Diagram\"}"
               //             + Environment.NewLine
               //             + "}";
               //    reWriteFile = true;
               //}

               //if (!reWriteFile)
               //{
               //    throw ex;
               //}
            }
         }
         return (solution);
      }
   }
}

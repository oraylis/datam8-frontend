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

using System.Collections.Generic;
using System.Linq;
using System.Text;
using Dm8Data.Core;
using Dm8Data.Curated;

namespace Dm8Data.Helper
{
   public class PrintEntityOptions
   {
      public bool ShowAllAttributes { get; set; } = true;
   }

   public class MermaidHelper
   {
      private readonly HashSet<string> dm8lPrinted;
      private readonly HashSet<CoreEntity> cache;
      private readonly HashSet<KeyValuePair<CoreEntity ,CuratedFunction>> functionCache;
      private readonly GraphType graphType;

      public enum GraphType
      {
         ErDiagram,
         ClassDiagram
      }

      public MermaidHelper(GraphType graphType = GraphType.ErDiagram)
      {
         this.dm8lPrinted = new HashSet<string>();
         this.cache = new HashSet<CoreEntity>();
         this.functionCache = new HashSet<KeyValuePair<CoreEntity ,CuratedFunction>>();
         this.graphType = graphType;
      }

      public StringBuilder PrintInit()
      {
         StringBuilder mermaid = new StringBuilder();
         if (this.graphType == GraphType.ErDiagram)
         {
            mermaid.AppendLine(@"erDiagram");
         } else
         {
            mermaid.AppendLine(@"classDiagram");
         }
         mermaid.AppendLine();
         return mermaid;
      }

      public StringBuilder PrintAllRelationship()
      {
         StringBuilder rc = new StringBuilder();
         foreach (var entity in this.cache)
         {
            foreach (var relationship in entity.Relationship)
            {
               rc.Append(this.PrintRelationship(entity ,relationship));
            }
         }

         foreach (var function in this.functionCache)
         {
            List<CoreEntity> sourceEntities = new List<CoreEntity>();
            foreach (var functionSource in function.Value.Source)
            {
               var cacheEntity = this.cache.Where(e => e.Dm8l == functionSource.Dm8l).FirstOrDefault();
               if (cacheEntity != null)
               {
                  sourceEntities.Add(cacheEntity);
               }
            }
            rc.Append(this.PrintDependency(function.Key ,sourceEntities ,function.Value.Name));
         }
         return rc;
      }

      public StringBuilder PrintEntity(CoreEntity entity ,PrintEntityOptions printEntityOptions = null)
      {
         if (this.dm8lPrinted.Contains(entity.Dm8l))
            return new StringBuilder();

         this.dm8lPrinted.Add(entity.Dm8l);
         this.cache.Add(entity);

         if (printEntityOptions == null)
            printEntityOptions = new PrintEntityOptions();

         StringBuilder rc = new StringBuilder();
         if (this.graphType == GraphType.ErDiagram)
         {
            rc.AppendLine($"\"{entity.Dm8l}\" {{");
            foreach (var bkAttr in entity.Attribute)
            {
               if (printEntityOptions.ShowAllAttributes ||
                   bkAttr.BusinessKeyNo != null)
                  rc.AppendLine(
                      $"{bkAttr.DataType} {bkAttr.Name} {(bkAttr.BusinessKeyNo != null ? "PK" : "")} \"-{bkAttr.AttributeType}- {bkAttr.DisplayName}\"");
            }
            rc.AppendLine($"}}");
            rc.AppendLine();
         }

         if (this.graphType == GraphType.ClassDiagram)
         {
            rc.AppendLine($"namespace {GetNamespace(entity.Dm8l)} {{");
            rc.AppendLine($"    class {GetClass(entity.Dm8l)} {{");
            foreach (var bkAttr in entity.Attribute)
            {
               if (printEntityOptions.ShowAllAttributes ||
                   bkAttr.BusinessKeyNo != null)
                  rc.AppendLine(
                      $"      + {bkAttr.DataType} {bkAttr.Name}");
            }
            rc.AppendLine($"    }}");
            rc.AppendLine($"}}");
            rc.AppendLine();
         }


         return rc;
      }

      private static string GetClass(string entityDm8L)
      {
         string rc = entityDm8L;
         rc = rc.Substring(rc.LastIndexOf('/') + 1);
         return rc;
      }

      private string GetNamespace(string entityDm8L)
      {
         string rc = entityDm8L.Substring(1);
         rc = rc.Substring(0 ,rc.LastIndexOf('/'));
         rc = rc.Replace("/" ,"_");
         return rc;
      }

      public StringBuilder PrintIsA(CoreEntity entity)
      {
         if (!this.dm8lPrinted.Contains(entity.Dm8l) ||
             !this.dm8lPrinted.Contains(entity.ExtensionOf))
            return new StringBuilder();

         StringBuilder rc = new StringBuilder();
         if (this.graphType == GraphType.ErDiagram)
         {
            rc.AppendLine($"\"{entity.Dm8l}\"|o--o| \"{entity.ExtensionOf}\" : is");
            rc.AppendLine();
         }
         if (this.graphType == GraphType.ClassDiagram)
         {
            rc.AppendLine($"{GetClass(entity.Dm8l)} <|-- {GetClass(entity.ExtensionOf)} : is");
            rc.AppendLine();
         }

         return rc;
      }


      public StringBuilder PrintRelationship(CoreEntity entity ,Relationship rel)
      {
         if (!this.dm8lPrinted.Contains(entity.Dm8l) ||
             !this.dm8lPrinted.Contains(rel.Dm8lKey))
            return new StringBuilder();


         StringBuilder rc = new StringBuilder();
         if (this.graphType == GraphType.ErDiagram)
         {
            string roleEmpty = "\"\"";
            string undef = "#";
            rc.AppendLine($"\"{entity.Dm8l}\" ||--o{{ \"{rel.Dm8lKey}\" : {(string.IsNullOrEmpty(rel.Role) || rel.Role == undef ? roleEmpty : rel.Role)}");
            rc.AppendLine();
         }
         if (this.graphType == GraphType.ClassDiagram)
         {
            string roleEmpty = "#";
            rc.AppendLine($"{GetClass(entity.Dm8l)} --* {GetClass(rel.Dm8lKey)} : {(string.IsNullOrEmpty(rel.Role) ? rel.Role : roleEmpty)}");
            rc.AppendLine();
         }

         return rc;
      }

      public StringBuilder PrintDependency(CoreEntity entityTarget ,List<CoreEntity> entitySources ,string functionName = "")
      {
         var rc = new StringBuilder();
         if (this.graphType == GraphType.ClassDiagram)
         {
            rc.AppendLine($"namespace {GetNamespace(entityTarget.Dm8l)} {{");
            rc.AppendLine($"    class I{GetClass(entityTarget.Dm8l)} {{");
            rc.AppendLine($"    <<interface>>");
            rc.AppendLine($"     +{functionName}()");
            rc.AppendLine($"    }}");
            rc.AppendLine($"}}");
            rc.AppendLine($"{GetClass(entityTarget.Dm8l)} <|-- I{GetClass(entityTarget.Dm8l)} : implements");
         }

         foreach (CoreEntity entitySource in entitySources)
         {
            if (!this.dm8lPrinted.Contains(entityTarget.Dm8l) ||
                !this.dm8lPrinted.Contains(entitySource.Dm8l))
               continue;

            if (this.graphType == GraphType.ErDiagram)
            {
               rc.AppendLine($"\"{entityTarget.Dm8l}\" ||--o{{ \"{entitySource.Dm8l}\" : {functionName}");
               rc.AppendLine();
            }
            if (this.graphType == GraphType.ClassDiagram)
            {
               rc.AppendLine($"I{GetClass(entityTarget.Dm8l)} <-- {GetClass(entitySource.Dm8l)} : {functionName}");
               rc.AppendLine();
            }
         }
         return rc;
      }

      public StringBuilder PrintFunction(CoreEntity entityTarget ,CuratedFunction functionSource)
      {
         StringBuilder rc = new StringBuilder();
         if (this.graphType == GraphType.ClassDiagram)
         {
            rc.AppendLine($"{GetClass(entityTarget.Dm8l)}: +{functionSource.Name}()");
            rc.AppendLine();
         }
         this.functionCache.Add(new KeyValuePair<CoreEntity ,CuratedFunction>(entityTarget ,functionSource));
         return rc;
      }
   }
}

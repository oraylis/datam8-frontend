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
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.SqlServer.TransactSql.ScriptDom;

namespace Dm8Locator.Db.TSql
{
   /// <summary>
   /// Scan TSql-Files and create Database Resource Locators
   /// </summary>
   public class Dm8DataLocatorTsqlParser:Dm8DataLocatorDbParserBase
   {
      private string Folder;

      public Dm8DataLocatorTsqlParser(string db ,string folder ,Func<string[] ,string> createAdlName = null)
          : base(db ,createAdlName)
      {
         this.Folder = folder;
      }

      public async Task ScanFolder(Action<Dm8LocatorBase> storeAction)
      {
         // Store left/right result of comparison
         List<Task> parserTasks = new List<Task>();
         foreach (var sqlFile in Directory.GetFiles(this.Folder ,"*.sql" ,SearchOption.AllDirectories))
         {
            parserTasks.Add(Task.Factory.StartNew(() => this.ScanFile(storeAction ,sqlFile)));
         }

         // Wait for tasks to complete
         await Task.WhenAll(parserTasks.ToArray());

         // check results
      }

      private void ScanFile(Action<Dm8LocatorBase> storeAction ,string sqlFile)
      {
         try
         {
            this.ParseTSqlFile(sqlFile ,storeAction);
         } catch (TSqlParserException ex)
         {
            StringBuilder stringBuilder = new StringBuilder();
            foreach (var err in ex.Errors)
            {
               stringBuilder.Append("(");
               stringBuilder.Append($"{err.Message} [{err.Line}, {err.Column}]");
               stringBuilder.Append(") ");
            }
            throw new TSqlParserException($"Error parsing file '{sqlFile}' ({ex.Message}): ${stringBuilder.ToString()}" ,ex);
         } catch (Exception ex)
         {
            throw new TSqlParserException($"Error parsing file '{sqlFile}' ({ex.Message})" ,ex);
         }
      }

      private void ParseTSqlFile(string sqlFile ,Action<Dm8LocatorBase> storeAdl)
      {
         // Read SQL File
         string sqlStatement = File.ReadAllText(sqlFile);

         // Use TSqlParser scanner for scanning view(s)/tables(s)
         TSqlParser parser = new TSql150Parser(false ,SqlEngineType.All);

         // Initiate Parser
         StringReader reader = new StringReader(sqlStatement);
         TSqlFragment fragment = parser.Parse(reader ,out IList<ParseError> errors);

         // Check if errors occurred
         if (errors.Count() > 0)
         {
            throw new TSqlParserException($"Error parsing {sqlFile}" ,errors);
         }

         // Parse Tables
         TSqlTableVisitor tableVisitor = new TSqlTableVisitor();
         tableVisitor.CreateDm8DataLocatorName = this.CreateDm8DataLocatorName;
         tableVisitor.StoreDm8DataLocator = storeAdl;

         // Parse Views
         TSqlViewVisitor viewVisitor = new TSqlViewVisitor();
         viewVisitor.CreateDm8DataLocatorName = this.CreateDm8DataLocatorName;
         viewVisitor.StoreDm8DataLocator = storeAdl;

         // Parse Procedures
         TSqlViewVisitor procVisitor = new TSqlViewVisitor();
         viewVisitor.CreateDm8DataLocatorName = this.CreateDm8DataLocatorName;
         viewVisitor.StoreDm8DataLocator = storeAdl;

         fragment.Accept(viewVisitor);
         fragment.Accept(tableVisitor);

      }
   }
}

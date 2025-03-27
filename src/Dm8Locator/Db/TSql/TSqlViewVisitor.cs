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
using System.Linq;
using System.Text;
using Dm8Locator.Db;
using Dm8Locator.Db.TSql;
using Microsoft.SqlServer.TransactSql.ScriptDom;
using PoorMansTSqlFormatterRedux.Formatters;
using PoorMansTSqlFormatterRedux.Interfaces;
using PoorMansTSqlFormatterRedux.Parsers;
using PoorMansTSqlFormatterRedux.Tokenizers;

/// <summary>
/// Visitor class for Table Statement
/// </summary>
namespace Dm8Locator.Db.TSql
{
    /// <summary>
    /// The 'Table' visitor for the TSql script DOM.
    /// </summary>
    class TSqlViewVisitor : TSqlFragmentVisitor
    {
        public Action<Dm8LocatorBase> StoreDm8DataLocator { get; set; }

        public Func<string[], string> CreateDm8DataLocatorName { get; set; }

        public List<Dm8LocatorBase> Nodes { get; protected set; } = new List<Dm8LocatorBase>();

        private Dm8LocatorView currentView = new Dm8LocatorView();

        /// <summary>
        ///  Visitor for 'Table' Statement
        /// </summary>
        /// <param name="node"></param>
        public override void Visit(CreateViewStatement node)
        {
            base.Visit(node);

            var viewIdentifier = node.SchemaObjectName.Identifiers.Select(i => i.Value).ToArray();
            string AdlName = this.CreateDm8DataLocatorName(viewIdentifier);

            //
            StringBuilder originalStatement = new StringBuilder();
            foreach (var token in node.ScriptTokenStream)
            {
                originalStatement.Append(token.Text);
            }

            // TSql Formatted Create View
            Sql150ScriptGenerator sqlScriptGenerator = new Sql150ScriptGenerator();
            sqlScriptGenerator.GenerateScript(node, out string createViewScript);

            // Format script
            StringBuilder formattedViewScript = new StringBuilder();
            TSqlStandardTokenizer tokenizer = new TSqlStandardTokenizer();
            TSqlStandardParser parser = new TSqlStandardParser();
            TSqlStandardFormatter treeFormatter = new TSqlStandardFormatter();
            treeFormatter.Options.TrailingCommas = false;
            ITokenList tokenized = tokenizer.TokenizeSQL(originalStatement.ToString());
            var parsed = parser.ParseSQL(tokenized);
            formattedViewScript.Append(treeFormatter.FormatSQLTree(parsed));
            formattedViewScript.AppendLine("GO");


            // Create view
            Dm8LocatorView AdlView = new Dm8LocatorView(AdlName);
            SqlDm8LocatorViewProperties viewProperties = new SqlDm8LocatorViewProperties();
            viewProperties.OriginalCreateViewScript = originalStatement.ToString();
            viewProperties.SqlFormattedCreateViewScript = createViewScript;
            viewProperties.PoorMansFormattedCreateViewScript = formattedViewScript.ToString();
            AdlView.SpecializedProperties = viewProperties;

            // Store current view
            this.currentView = AdlView;
            this.StoreDm8DataLocator(this.currentView);
        }

        /// <summary>
        ///  Visitor for 'Table' Statement
        /// </summary>
        /// <param name="node"></param>
        public override void Visit(TableReference node)
        {
            base.Visit(node);
            if (node is NamedTableReference namedTableReference)
            {
                var tableIdentifier = namedTableReference.SchemaObject.Identifiers.Select(i => i.Value).ToArray();
                string AdlName = this.CreateDm8DataLocatorName(tableIdentifier);

                // add to source
                if (this.currentView != null &&
                    this.currentView.SpecializedProperties is SqlDm8LocatorViewProperties viewProperties)
                {
                    viewProperties.SourceResources.Add(AdlName);
                }
            }
        }


    }
}

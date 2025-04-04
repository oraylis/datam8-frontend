using System;
using System.Collections.Generic;
using System.Linq;
using Dm8Locator.Db;
using Dm8Locator.Db.TSql;
using Microsoft.SqlServer.TransactSql.ScriptDom;

/// <summary>
/// Visitor class for Table Statement
/// </summary>
namespace Dm8Locator.Db.TSql
{
    /// <summary>
    /// The 'Table' visitor for the TSql script DOM.
    /// </summary>
    public class TSqlTableVisitor : TSqlFragmentVisitor
    {
        public Action<Dm8LocatorBase> StoreDm8DataLocator { get; set; }

        public Func<string[], string> CreateDm8DataLocatorName { get; set; }

        public List<Dm8LocatorBase> Nodes { get; protected set; } = new List<Dm8LocatorBase>();

        /// <summary>
        ///  Visitor for 'Table' Statement
        /// </summary>
        /// <param name="node"></param>
        public override void Visit(CreateTableStatement node)
        {
            base.Visit(node);

            // fill DbAdl
            var tableIdentifier = node.SchemaObjectName.Identifiers.Select(i => i.Value).ToArray();
            string AdlName = this.CreateDm8DataLocatorName(tableIdentifier);
            Dm8LocatorTable AdlTable = new Dm8LocatorTable(AdlName);

            // TODO: Fill direct attributes

            this.StoreDm8DataLocator(AdlTable);

            // ColumnDefinitions
            string[] colPlacehoder = { "" };
            var colIdentifier = tableIdentifier.Union(colPlacehoder).ToArray();
            short colNr = 1;
            foreach (var col in node.Definition.ColumnDefinitions)
            {
                // create Adl identifier
                colIdentifier[2] = col.ColumnIdentifier.Value;
                var AdlColName = this.CreateDm8DataLocatorName(colIdentifier);

                // create resource locator
                Dm8LocatorColumn AdlCol = new Dm8LocatorColumn(AdlColName);

                // specific tsql column properties
                SqlDm8LocatorColumnProperties sqlAdlColumnProperties = new SqlDm8LocatorColumnProperties();   // attach type specific properties
                sqlAdlColumnProperties.DeriveTypeSpecificProperties(AdlCol, col, colNr++);

                // store type specific properties
                AdlCol.SpecializedProperties = sqlAdlColumnProperties;

                // TODO: Fill direct attributes

                this.StoreDm8DataLocator(AdlCol);
            }

            // TableConstraints

            // Indexes

        }


    }
}

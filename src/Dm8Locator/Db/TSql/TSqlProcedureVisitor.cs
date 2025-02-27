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
    class TSqlProcedureVisitor : TSqlFragmentVisitor
    {
        public Action<Dm8LocatorBase> StoreDm8DataLocator { get; set; }

        public Func<string[], string> CreateDm8DataLocatorName { get; set; }

        public List<Dm8LocatorBase> Nodes { get; protected set; } = new List<Dm8LocatorBase>();

        private Dm8LocatorProcedure currentProc = new Dm8LocatorProcedure();

        /// <summary>
        ///  Visitor for 'Table' Statement
        /// </summary>
        /// <param name="node"></param>
        public override void Visit(CreateProcedureStatement node)
        {
            base.Visit(node);

            var procIdentifier = node.ProcedureReference.Name.Identifiers.Select(i => i.Value).ToArray();
            string AdlName = this.CreateDm8DataLocatorName(procIdentifier);

         
            // Store current view
            this.currentProc = new Dm8LocatorProcedure(AdlName);
            this.StoreDm8DataLocator(this.currentProc);
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
                if (this.currentProc!= null )
                {
                    this.currentProc.SourceResources.Add(AdlName);
                }
            }
        }


    }
}

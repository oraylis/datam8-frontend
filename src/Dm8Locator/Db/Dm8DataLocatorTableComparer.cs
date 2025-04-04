using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Linq;
using Dm8Locator.Db;
using Dm8Locator.Db.TSql;
using Microsoft.SqlServer.TransactSql.ScriptDom;

/// <summary>
/// Visitor class for Table Statement
/// </summary>
namespace Dm8Locator.Db
{
    /// <summary>
    /// The 'Table' visitor for the TSql script DOM.
    /// </summary>
    public class Dm8DataLocatorTableComparer : IEqualityComparer<Dm8LocatorBase>
    {
        public bool Equals(Dm8LocatorBase x, Dm8LocatorBase y)
        {
            return Dm8LocatorComparer.Default.Equals(x, y);
        }

        public int GetHashCode([DisallowNull] Dm8LocatorBase obj)
        {
            throw new NotImplementedException();
        }
    }
}

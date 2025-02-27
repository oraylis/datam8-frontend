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
    public class Dm8LocatorViewComparer : IEqualityComparer<Dm8LocatorBase>
    {
        public bool Equals(Dm8LocatorBase x, Dm8LocatorBase y)
        {
            // check if one is null and the other not
            if (ReferenceEquals(x, null) != ReferenceEquals(y, null))
                return false;

            Dm8LocatorView viewX = x as Dm8LocatorView;
            if (viewX == null)
                throw new ArgumentException($"{x} is not of type column {x.GetType().ToString()}");
            Dm8LocatorView viewY = y as Dm8LocatorView;
            if (viewY == null)
                throw new ArgumentException($"{y} is not of type column {y.GetType().ToString()}");

            // Views need to be compared by script
            string scriptX = viewX.SpecializedProperties?.GetCompareScript();
            string scriptY = viewY.SpecializedProperties?.GetCompareScript();

            return StringComparer.InvariantCultureIgnoreCase.Compare(scriptX, scriptY) == 0;
        }

        public int GetHashCode([DisallowNull] Dm8LocatorBase obj)
        {
            throw new NotImplementedException();
        }
    }
}

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
    public class Dm8DataLocatorColumnComparer : IEqualityComparer<Dm8LocatorBase>
    {
        public bool Equals(Dm8LocatorBase x, Dm8LocatorBase y)
        {
            // check if one is null and the other not
            if (ReferenceEquals(x, null) != ReferenceEquals(y, null))
                return false;

            Dm8LocatorColumn colX = x as Dm8LocatorColumn;
            if (colX == null)
                throw new ArgumentException($"{x} is not of type column {x.GetType().ToString()}");
            Dm8LocatorColumn colY = y as Dm8LocatorColumn;
            if (colY == null)
                throw new ArgumentException($"{y} is not of type column {y.GetType().ToString()}");

            // compare elements
            bool rc = true;
            rc &= Dm8LocatorComparer.Default.Equals(x, y);
            rc &= (colX.DataType == colY.DataType);
            rc &= (colX.DataTypeLength ?? 0) == (colY.DataTypeLength ?? 0);
            rc &= (colX.DataTypePrecision ?? 0) == (colY.DataTypePrecision ?? 0);
            rc &= (colX.DataTypeScale ?? 0) == (colY.DataTypeScale ?? 0);
            rc &= StringComparer.InvariantCulture.Compare(colX.DefaultExpression, colY.DefaultExpression) == 0;
            rc &= (colX.IsNullable) == (colY.IsNullable);

            return rc;
        }

        public int GetHashCode([DisallowNull] Dm8LocatorBase obj)
        {
            throw new NotImplementedException();
        }
    }
}

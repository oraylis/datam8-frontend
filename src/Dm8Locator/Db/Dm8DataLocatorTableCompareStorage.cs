namespace Dm8Locator.Db
{
    public class Dm8DataLocatorTableCompareStorage
    {
        /// <summary>
        /// Internal result storage (left, right)
        /// </summary>
        internal readonly Dm8LocatorDictionary<Dm8DataLocatorPairWithChildren> result = new Dm8LocatorDictionary<Dm8DataLocatorPairWithChildren>();

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8DataLocatorTableCompareStorage"/> class.
        /// </summary>
        /// <param name="table">The table.</param>
        /// <param name="addLeft">if set to <c>true</c> [left].</param>
        public void StoreTable(bool addLeft, Dm8LocatorTable table)
        {
            lock (this)
            {
                if (this.result.TryGetValue(table, out Dm8DataLocatorPairWithChildren value))
                {
                    if (addLeft)
                    {
                        if (value.left != null)
                            throw new DuplicateDm8LocatorException(table, "Found twice on left side");
                        value.left = table;
                    }
                    else
                    {
                        if (value.right != null)
                            throw new DuplicateDm8LocatorException(table, "Found twice on right side");
                        value.right = table;
                    }
                }
                else
                {
                    var newValue = new Dm8DataLocatorPairWithChildren { left = addLeft ? table : null, right = addLeft ? null : table};
                    this.result.Add(table, newValue);
                }
            }
        }

        /// <summary>
        /// Stores the column as a child element of the table (parent).
        /// </summary>
        /// <param name="addLeft">if set to <c>true</c> [add left].</param>
        /// <param name="column">The column.</param>
        /// <exception cref="Dm8LocatorBase.TSqlParserException">
        /// Found twice on left side
        /// or
        /// Found twice on right side
        /// </exception>
        public void StoreColumn(bool addLeft, Dm8LocatorColumn column)
        {
            Dm8LocatorBase table = column.Parent;
            lock (this)
            {
                if (this.result.TryGetValue(table, out Dm8DataLocatorPairWithChildren tblValue))
                {
                    if (tblValue.Children.TryGetValue(column, out Dm8DataLocatorPair colValue))
                    {
                        if (addLeft)
                        {
                            if (colValue.left != null)
                                throw new DuplicateDm8LocatorException(column, "Found twice on left side");
                            colValue.left = column;
                        }
                        else
                        {
                            if (colValue.right != null)
                                throw new DuplicateDm8LocatorException(column, "Found twice on right side");
                            colValue.right = column;
                        }
                    }
                    else
                    {
                        tblValue.Children.Add(column, new Dm8DataLocatorPair { left = addLeft ? column : null, right = addLeft ? null : column });
                    }
                }
                else
                {                    
                    // column added before table
                    var newValue = new Dm8DataLocatorPairWithChildren();
                    newValue.Children.Add(column, new Dm8DataLocatorPair { left = addLeft ? column : null, right = addLeft ? null : column });
                    this.result.Add(table, newValue);
                }
            }
        }
    }
}

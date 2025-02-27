namespace Dm8Locator.Db
{
    public class Dm8DataLocatorCompareStorage
    {
        /// <summary>
        /// Internal result storage (left, right)
        /// </summary>
        internal readonly Dm8LocatorDictionary<Dm8DataLocatorPair> result = new Dm8LocatorDictionary<Dm8DataLocatorPair>();

        /// <summary>
        /// Initializes a new instance of the <see cref="Dm8DataLocatorCompareStorage"/> class.
        /// </summary>
        /// <param name="Adl">The data resource locator.</param>
        /// <param name="addLeft">if set to <c>true</c> [left].</param>
        public void StoreDm8DataLocator(bool addLeft, Dm8LocatorBase Adl)
        {
            lock (this)
            {
                if (this.result.TryGetValue(Adl, out Dm8DataLocatorPair value))
                {
                    if (addLeft)
                    {
                        if (value.left != null)
                            throw new DuplicateDm8LocatorException(Adl, "Found twice on left side");
                        value.left = Adl;
                    }
                    else
                    {
                        if (value.right != null)
                            throw new DuplicateDm8LocatorException(Adl, "Found twice on right side");
                        value.right = Adl;
                    }
                }
                else
                {
                    var newValue = new Dm8DataLocatorPair { left = addLeft ? Adl : null, right = addLeft ? null : Adl };
                    this.result.Add(Adl, newValue);
                }
            }
        }
    }
}

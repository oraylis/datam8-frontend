using System.Collections.Generic;

namespace Dm8Locator.Db
{
    public enum Dm8LocatorChangeType
    {
        Unkown,
        NotChange,
        New,
        Deleted,
        Changed        
    }

    public class Dm8LocatorChange
    {
        public Dm8LocatorChangeType ChangeType { get; set; }

        public Dm8DataLocatorPair MainObject { get; set; }

        public List<Dm8DataLocatorPair> Changes { get; set; } = new List<Dm8DataLocatorPair>();
        
    }
}
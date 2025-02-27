using System;
using System.Linq;
using System.Runtime.Serialization;
using System.Security.Permissions;

namespace Dm8Locator.Db
{
    [Serializable]
    public sealed class Dm8LocatorSchema : Dm8LocatorBase
    {
        public Dm8LocatorSchema() : base() { }
        public Dm8LocatorSchema(string dm8l) : base(dm8l) { }
        public Dm8LocatorSchema(Dm8LocatorBase copy) : base(copy) { }
        public Dm8LocatorSchema(SerializationInfo info, StreamingContext context) : base(info, context) { }
        
        protected override Dm8LocatorBase CreateParent(string dm8l) 
        {
            // no more parents
            return new Dm8LocatorDb(dm8l); 
        }
    }

}

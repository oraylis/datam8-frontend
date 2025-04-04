using System;
using Dm8Data.Helper;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Collections;
using Dm8Locator.Dm8l;

namespace Dm8Data.Validate.Exceptions
{
    public class EntityNotFoundException : ModelReaderException
    {
        public const string MessageFormat = "Entity with locator '{0}' not found";

        public string Dm8l { get; set; }

        public EntityNotFoundException(string dm8l)
        {
            this.Code = "R002";
            this.Dm8l = dm8l;
        }

        public override string Message => string.Format(MessageFormat, this.Dm8l);

        public override string Source
        {
            get => $"Entity Error: Locator {this.Dm8l} not found";
        }
    }
}

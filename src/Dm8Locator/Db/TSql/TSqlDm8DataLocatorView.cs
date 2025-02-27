using Dm8Locator;
using Microsoft.SqlServer.TransactSql.ScriptDom;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.Serialization;
using System.Text;
using System.Threading.Tasks;

namespace Dm8Locator.Db.TSql
{

    /// <summary>
    /// TSQL column specific 
    /// </summary>
    /// <seealso cref="Dm8LocatorBase.Db.AdlColumn" />
    public class SqlDm8LocatorViewProperties : IDm8LocatorSpecializedProperties
    {
        public string OriginalCreateViewScript { get; set; }

        public string SqlFormattedCreateViewScript { get; set; }

        public string PoorMansFormattedCreateViewScript { get; set; }

        public List<string> SourceResources { get; set; } = new List<string>();

        /// <summary>
        /// Initializes a new instance of the <see cref="SqlDm8LocatorViewProperties"/> class.
        /// </summary>
        public SqlDm8LocatorViewProperties()
        {
        }


        public string GetScript()
        {
            return this.OriginalCreateViewScript;
        }

        public string GetCompareScript()
        {
            // use formatted script incl. 
            return this.PoorMansFormattedCreateViewScript;
        }
    }
}

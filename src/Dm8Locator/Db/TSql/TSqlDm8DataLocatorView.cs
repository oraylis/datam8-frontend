/* DataM8
 * Copyright (C) 2024-2025 ORAYLIS GmbH
 *
 * This file is part of DataM8.
 *
 * DataM8 is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * DataM8 is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

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

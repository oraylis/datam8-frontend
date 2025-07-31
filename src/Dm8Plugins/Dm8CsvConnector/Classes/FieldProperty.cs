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

using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Oraylis.DataM8.PluginBase.Interfaces;
using Newtonsoft.Json;
using CategoryAttribute = PropertyTools.DataAnnotations.CategoryAttribute;


namespace Dm8CSVConnector.Classes
{
    public class FieldProperty
    {
        public string Name { get; set; } = "";
        public string Type { get; set; } = "string";

        [JsonProperty(NullValueHandling = NullValueHandling.Ignore)]
        public int? Size { get; set; }

        [JsonProperty(NullValueHandling = NullValueHandling.Ignore)]
        public int? Precision { get; set; }

        public bool NullEnabled { get; set; } = true;

        [Newtonsoft.Json.JsonIgnore]
        public string SampleData { get; set; } = "";

        public override string ToString()
        {
            return this.Name;
        }
    }
}

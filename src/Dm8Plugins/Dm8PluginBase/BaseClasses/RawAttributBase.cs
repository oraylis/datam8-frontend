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

using Dm8PluginBase.Interfaces;

namespace Dm8PluginBase.BaseClasses
{
#pragma warning disable CS8625
#pragma warning disable CS8618
    public class RawAttributBase : Prism.Mvvm.BindableBase, IRawAttributBase
    {
        public string Name { get; set; } = "";
        public string Type { get; set; } = "";
        public int? CharLength { get; set; }
        public string CharSet { get; set; } = "";
        public int? Precision { get; set; }
        public int? Scale { get; set; }
        public bool? Nullable { get; set; }
        public string UnitName { get; set; } = "";
        public string UnitType { get; set; } = "";
        public System.Collections.ObjectModel.ObservableCollection<string> Tags { get; set; }
        public string? DateModified { get; set; }
        public string? DateDeleted { get; set; }
    }
}

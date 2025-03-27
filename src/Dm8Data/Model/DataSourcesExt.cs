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
using System.Collections;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using Dm8Data.Base;
using Dm8Data.Generic;

namespace Dm8Data.DataSources
{
    public partial class DataSources : Prism.Mvvm.BindableBase, IModelEntryList<DataSource>
    {
        public DataSources()
        {
            this.Items = new ObservableCollection<DataSource>();
        }

        public ObservableCollection<DataSource> Values => this.Items as ObservableCollection<DataSource>;

        IEnumerable IModelEntryList.Values => this.Items;
    }

    public partial class DataSource
    {
        public Dictionary<string, string> ExtendedProperties = new Dictionary<string, string>();

    }
}

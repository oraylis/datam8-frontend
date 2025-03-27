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
using Dm8Data.DataSources;
using Dm8PluginBase.Interfaces;
using CategoryAttribute = PropertyTools.DataAnnotations.CategoryAttribute;

namespace Dm8Main.Models
{
    [DisplayName("Data Source")]
    public class DataSourceInfo
    {
        private DataSource _owner;

        [CategoryAttribute("Naming")]
        [Display(Name = "Name", Description = "Name of Data Source")]
        public string Name
        {
            get
            {
                return (_owner?.Name);
            }
            set
            {
                _owner.Name = value;
            }
        }
        [Display(Name = "Display Name", Description = "Displayname of Data Source")]
        public string DisplayName
        {
            get { return (_owner?.DisplayName); }
            set { _owner.DisplayName = value; }
        }
        [Display(Name = "Purpuse", Description = "Purpose of Data Source")]
        public string Purpose
        {
            get { return (_owner?.Purpose); }
            set { _owner.Purpose = value; }
        }

        [CategoryAttribute("Info")]
        [ReadOnly(true)]
        [Display(Name = "Type", Description = "Type of Data Source")]
        public string Type
        {
            get
            {
                return (_owner?.Type);
            }
        }
        [Display(Name = "Connection String", Description = "")]
        [ReadOnly(true)]
        public string ConnectionString
        {
            get
            {
                return (_owner?.ConnectionString);
            }
        }

        [CategoryAttribute("Mapping")]
        [Display(Name = "Datatype Mapping", Description = "")]
        public ObservableCollection<DataTypeMapping> DataTypeMapping
        {
            get
            {
                return (_owner?.DataTypeMapping);
            }
        }

        public DataSourceInfo(DataSource obj)
        {
            _owner = obj;
        }
    }



}

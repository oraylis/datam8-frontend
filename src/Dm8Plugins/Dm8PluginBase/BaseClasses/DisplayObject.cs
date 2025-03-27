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

using System.ComponentModel;

namespace Dm8PluginBase.BaseClasses
{
    public class DisplayObject<T> where T : class
    {
        public string Name { get; set; } = "";
        public string DisplayName { get; set; } = "";
        public string Schema { get; set; } = "";
        public string Type { get; set; } = "";
        public string Source { get; set; } = "";
        public T? Cargo { get; set; }
        public bool IsChecked
        {
            get
            {
                return (_isChecked);
            }
            set
            {
                _isChecked = value;
                OnCheckableChanged(new PropertyChangedEventArgs("IsChecked"));
            }
        }
        private bool _isChecked = false;
        protected virtual void OnCheckableChanged(PropertyChangedEventArgs args)
        {
            CheckableChanged?.Invoke(this, args);
        }
        public event PropertyChangedEventHandler? CheckableChanged;
    }
}

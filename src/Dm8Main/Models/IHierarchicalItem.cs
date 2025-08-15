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

using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace Dm8Main.Models
{
   public interface IHierarchicalItem<T> where T : class, IHierarchicalItem<T>
   {
      string Name { get; set; }

      ObservableCollection<HierarchicalItem<T>> Children { get; }

      bool HasItems { get; }

      bool IsExpanded { get; set; }

      bool IsSelected { get; set; }

      T GetThis();

      void UpdateFrom(HierarchicalItem<T> other);

      void CopyAttributes(HierarchicalItem<T> other);

      public IEnumerable<HierarchicalItem<T>> GetItems();
   }
}
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
using System.Windows;

namespace Dm8Main.Models
{
   public class HierarchicalItem<T>:Prism.Mvvm.BindableBase, IHierarchicalItem<T> where T : class, IHierarchicalItem<T>
   {
      #region Property Name
      public string Name
      {
         get => this.name;
         set => this.SetProperty(ref this.name ,value);
      }

      private string name;
      #endregion

      #region Property Children
      public ObservableCollection<HierarchicalItem<T>> Children
      {
         get => this.children;
         set => this.SetProperty(ref this.children ,value);
      }

      private ObservableCollection<HierarchicalItem<T>> children;
      #endregion

      #region Property IsSelected
      public bool IsSelected
      {
         get => this.isSelected;
         set => this.SetProperty(ref this.isSelected ,value);
      }

      private bool isSelected;
      #endregion

      #region Property IsExpanded
      public bool IsExpanded
      {
         get => this.isExpanded;
         set => this.SetProperty(ref this.isExpanded ,value);
      }

      private bool isExpanded;

      private bool? isExpanded_Restore;
      #endregion

      #region Property Visibility
      public Visibility Visibility
      {
         get => this.visibility;
         set => this.SetProperty(ref this.visibility ,value);
      }

      private Visibility visibility;
      #endregion

      #region Property HasItems
      public bool HasItems => this.Children.Count > 0;

      #endregion

      public HierarchicalItem()
      {
         this.Children = new ObservableCollection<HierarchicalItem<T>>();
      }

      public void ResetFilter()
      {
         foreach (var item in this.GetItems())
         {
            if (item.isExpanded_Restore != null)
            {
               item.IsExpanded = item.isExpanded_Restore.Value;
               item.isExpanded_Restore = null;
            }
            item.Visibility = Visibility.Visible;
         }
      }

      public bool Filter(Func<HierarchicalItem<T> ,bool> filter ,HierarchicalItem<T> item = null)
      {
         if (item == null)
         {
            item = this;
         }

         // store IsExpanded for reset
         if (item.isExpanded_Restore == null)
         {
            item.isExpanded_Restore = item.IsExpanded;
         }

         bool rc = false;
         foreach (var subItem in item.Children)
         {
            rc |= this.Filter(filter ,subItem);
         }

         if (rc) // one subitem is contained in filter
         {
            item.IsExpanded = true;
            item.Visibility = Visibility.Visible;
         }
         else if (filter(item)) // this item is contained in filter
         {
            rc = true;
            item.IsExpanded = false;
            item.Visibility = Visibility.Visible;
         }
         else // item not contained in filter
         {
            item.Visibility = Visibility.Collapsed;
         }

         return rc;
      }

      public void UpdateFrom(HierarchicalItem<T> other)
      {
         // loop over both sets
         int iThis = 0;
         int iOther = 0;

         while (true)
         {
            if (iThis >= this.Children.Count &&
                iOther >= other.Children.Count)
            {
               // done
               break;
            }

            else if (iThis < this.Children.Count &&
                iOther >= other.Children.Count)
            {
               this.Children.RemoveAt(iThis);
               iThis++;
            }

            else if (iThis >= this.Children.Count &&
                iOther < other.Children.Count)
            {
               this.Children.Add(other.Children[iOther]);
               iOther++;
               iThis++;
            }

            else
            {
               int comp = StringComparer.InvariantCultureIgnoreCase.Compare(this.Children[iThis].Name ,this.Children[iOther].Name);

               if (comp == 0)
               {
                  // compare sub elements
                  this.Children[iThis].CopyAttributes(other.Children[iOther]);
                  this.Children[iThis].UpdateFrom(other.Children[iOther]);
                  iThis++;
                  iOther++;
               }
               if (comp < 0)
               {
                  this.Children.RemoveAt(iThis);
                  iThis++;
               }
               if (comp > 0)
               {
                  this.Children.Insert(iThis ,other.Children[iOther]);
                  iOther++;
               }
            }

         }
      }

      public IEnumerable<HierarchicalItem<T>> GetItems()
      {
         foreach (var item in this.Children)
         {
            // depth first
            foreach (var subItem in item.GetItems())
            {
               yield return subItem;
            }
         }

         yield return this;
      }

      public virtual T GetThis()
      {
         return null;
      }

      public virtual void CopyAttributes(HierarchicalItem<T> other)
      {
         this.Name = other.Name;
      }

   }
}
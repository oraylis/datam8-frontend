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

namespace Dm8Locator.Db
{

   public class Dm8DataLocatorDbCompareStorage
   {
      public Dm8DataLocatorTableCompareStorage tableCompareStorage = new Dm8DataLocatorTableCompareStorage();

      public Dm8DataLocatorCompareStorage Dm8DataLocatorCompareStorage = new Dm8DataLocatorCompareStorage();

      public Dm8LocatorTypeComparer TypeComparer { get; set; } = new Dm8LocatorTypeComparer();


      public void StoreDm8DataLocatorLeft(Dm8LocatorBase Adl)
      {
         this.StoreDm8DataLocator(true ,Adl);
      }
      public void StoreDm8DataLocatorRight(Dm8LocatorBase Adl)
      {
         this.StoreDm8DataLocator(false ,Adl);
      }

      public void StoreDm8DataLocator(bool addLeft ,Dm8LocatorBase Adl)
      {
         if (Adl is Dm8LocatorTable table)
         {
            this.tableCompareStorage.StoreTable(addLeft ,table);
         }
         else if (Adl is Dm8LocatorColumn column && Adl.Parent is Dm8LocatorTable)
         {
            this.tableCompareStorage.StoreColumn(addLeft ,column);
         }
         else
         {
            // all other data resource locators are stored by script
            this.Dm8DataLocatorCompareStorage.StoreDm8DataLocator(addLeft ,Adl);
         }
      }

      public List<Dm8LocatorChange> CreateChangeSet()
      {
         List<Dm8LocatorChange> rc = new List<Dm8LocatorChange>();

         // Create changeset for tables
         foreach (var tblEntry in this.tableCompareStorage.result)
         {
            if (tblEntry.Value.left != null &&
                tblEntry.Value.right == null)
            {
               rc.Add(new Dm8LocatorChange { ChangeType = Dm8LocatorChangeType.New ,Changes = { tblEntry.Value } });
            }
            else if (tblEntry.Value.left == null &&
               tblEntry.Value.right != null)
            {
               rc.Add(new Dm8LocatorChange { ChangeType = Dm8LocatorChangeType.Deleted ,Changes = { tblEntry.Value } });
            }
            else
            {
               var changeEntry = new Dm8LocatorChange { ChangeType = Dm8LocatorChangeType.Changed };
               var isChanged = !this.TypeComparer.Equals(tblEntry.Value.left ,tblEntry.Value.right);
               foreach (var colEntry in tblEntry.Value.Children)
               {
                  if (!this.TypeComparer.Equals(colEntry.Value.left ,colEntry.Value.right))
                  {
                     changeEntry.Changes.Add(colEntry.Value);
                     isChanged = true;
                  }
               }
               if (isChanged)
               {
                  changeEntry.MainObject = tblEntry.Value;
                  rc.Add(changeEntry);
               }
               // no change -> do not store in change set
            }
         }

         // create change script for other objects
         foreach (var Adl in this.Dm8DataLocatorCompareStorage.result)
         {
            if (Adl.Value.left != null &&
              Adl.Value.right == null)
            {
               rc.Add(new Dm8LocatorChange { ChangeType = Dm8LocatorChangeType.New ,Changes = { Adl.Value } });
            }
            else if (Adl.Value.left == null &&
               Adl.Value.right != null)
            {
               rc.Add(new Dm8LocatorChange { ChangeType = Dm8LocatorChangeType.Deleted ,Changes = { Adl.Value } });
            }
            else
            {
               var changeEntry = new Dm8LocatorChange { ChangeType = Dm8LocatorChangeType.Changed };
               var isChanged = !this.TypeComparer.Equals(Adl.Value.left ,Adl.Value.right);
               if (isChanged)
               {
                  changeEntry.MainObject = Adl.Value;
                  rc.Add(changeEntry);
               }
            }
         }

         return rc;
      }
   }
}

using Dm8Locator.Db;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Dm8Locator.Db
{

    public class Dm8DataLocatorDbCompareStorage
    {
        public Dm8DataLocatorTableCompareStorage tableCompareStorage = new Dm8DataLocatorTableCompareStorage();

        public Dm8DataLocatorCompareStorage Dm8DataLocatorCompareStorage = new Dm8DataLocatorCompareStorage();

        public Dm8LocatorTypeComparer TypeComparer { get; set; } = new Dm8LocatorTypeComparer();


        public void StoreDm8DataLocatorLeft(Dm8LocatorBase Adl)
        {
            this.StoreDm8DataLocator(true, Adl);
        }
        public void StoreDm8DataLocatorRight(Dm8LocatorBase Adl)
        {
            this.StoreDm8DataLocator(false, Adl);
        }

        public void StoreDm8DataLocator(bool addLeft, Dm8LocatorBase Adl)
        {
            if (Adl is Dm8LocatorTable table)
            {
                this.tableCompareStorage.StoreTable(addLeft, table);
            }
            else if (Adl is Dm8LocatorColumn column && Adl.Parent is Dm8LocatorTable)
            {
                this.tableCompareStorage.StoreColumn(addLeft, column);
            }
            else
            {
                // all other data resource locators are stored by script
                this.Dm8DataLocatorCompareStorage.StoreDm8DataLocator(addLeft, Adl);
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
                    rc.Add(new Dm8LocatorChange { ChangeType = Dm8LocatorChangeType.New, Changes = { tblEntry.Value } });
                }
                else if (tblEntry.Value.left == null &&
                   tblEntry.Value.right != null)
                {
                    rc.Add(new Dm8LocatorChange { ChangeType = Dm8LocatorChangeType.Deleted, Changes = { tblEntry.Value } });
                }
                else
                {
                    var changeEntry = new Dm8LocatorChange { ChangeType = Dm8LocatorChangeType.Changed };
                    var isChanged = !this.TypeComparer.Equals(tblEntry.Value.left, tblEntry.Value.right);
                    foreach (var colEntry in tblEntry.Value.Children)
                    {
                        if (!this.TypeComparer.Equals(colEntry.Value.left, colEntry.Value.right))
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
                    rc.Add(new Dm8LocatorChange { ChangeType = Dm8LocatorChangeType.New, Changes = { Adl.Value } });
                }
                else if (Adl.Value.left == null &&
                   Adl.Value.right != null)
                {
                    rc.Add(new Dm8LocatorChange { ChangeType = Dm8LocatorChangeType.Deleted, Changes = { Adl.Value } });
                }
                else
                {
                    var changeEntry = new Dm8LocatorChange { ChangeType = Dm8LocatorChangeType.Changed };
                    var isChanged = !this.TypeComparer.Equals(Adl.Value.left, Adl.Value.right);
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

﻿/* DataM8
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

using Dm8DataLocator;
using Dm8DataLocator.Db;
using Dm8DataLocator.Db.TSql;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Dm8DataLocatorTest
{
    [TestClass]
    public class Dm8DataLocatorTSqlTest
    {
        // check changes


        [TestMethod]
        public void CompareLocalProject()
        {
            // Store compare result
            Dm8DataLocatorDbCompareStorage compareStorage = new Dm8DataLocatorDbCompareStorage();
            compareStorage.TypeComparer.AddTypeComparer(typeof(Dm8DataLocatorTable), new Dm8DataLocatorTableComparer());
            compareStorage.TypeComparer.AddTypeComparer(typeof(Dm8DataLocatorColumn), new Dm8DataLocatorColumnComparer());
            compareStorage.TypeComparer.AddTypeComparer(typeof(Dm8DataLocatorView), new Dm8DataLocatorViewComparer());

            // scan left side
            Dm8DataLocatorTsqlParser Dm8DataLocatorTSqlParserLeft = new Dm8DataLocatorTsqlParser("AdventureWorksDWH", @"..\..\..\AdventureWorksDWH");
            var taskLeft = Dm8DataLocatorTSqlParserLeft.ScanFolder(compareStorage.StoreDm8DataLocatorLeft);

            // scan right side
            Dm8DataLocatorTsqlParser Dm8DataLocatorTSqlParserRight = new Dm8DataLocatorTsqlParser("AdventureWorksDWH", @"..\..\..\AdventureWorksDWH.V2");
            var taskRight = Dm8DataLocatorTSqlParserRight.ScanFolder(compareStorage.StoreDm8DataLocatorRight);

            // create change set compare
            Task.WaitAll(taskLeft, taskRight);

            // find changes
            var rc = compareStorage.CreateChangeSet();
            Assert.IsTrue(rc.Where(c => c.ChangeType == Dm8DataLocatorChangeType.New).Count() == 1, "Different number of new objects; expected new objects is one");
            Assert.IsTrue(rc.Where(c => c.ChangeType == Dm8DataLocatorChangeType.Changed && c.MainObject.left is Dm8DataLocatorTable).Count() == 4, "Different number of changed objects; expected number of changes is '4'");
            Assert.IsTrue(rc.Where(c => c.ChangeType == Dm8DataLocatorChangeType.Changed && c.MainObject.left is Dm8DataLocatorView).Count() == 1, "Different number of changed objects; expected number of changes is '1'");
        }


        [TestMethod]
        public void CompareLocalProjectVsDatabase()
        {
            // Store compare result
            Dm8DataLocatorDbCompareStorage compareStorage = new Dm8DataLocatorDbCompareStorage();
            compareStorage.TypeComparer.AddTypeComparer(typeof(Dm8DataLocatorTable), new Dm8DataLocatorTableComparer());
            compareStorage.TypeComparer.AddTypeComparer(typeof(Dm8DataLocatorColumn), new Dm8DataLocatorColumnComparer());
            compareStorage.TypeComparer.AddTypeComparer(typeof(Dm8DataLocatorView), new Dm8DataLocatorViewComparer());

            // scan left side
            Dm8DataLocatorTsqlParser Dm8DataLocatorTSqlParser = new Dm8DataLocatorTsqlParser("AdventureWorksDWH", @"..\..\..\AdventureWorksDWH.V2");
            var taskLeft = Dm8DataLocatorTSqlParser.ScanFolder(compareStorage.StoreDm8DataLocatorLeft);

            // scan right side
            Dm8DataLocatorDbParser Dm8DataLocatorDbParser = new Dm8DataLocatorDbParser("AdventureWorksDWH", "Server=localhost;Database=AdventureWorksDWH;Trusted_Connection=True;");
            var taskRight = Dm8DataLocatorDbParser.ScanDb(compareStorage.StoreDm8DataLocatorRight, "dbo");

            // create change set compare
            Task.WaitAll(taskLeft, taskRight);

            // find changes
            var rc = compareStorage.CreateChangeSet();
            Assert.IsTrue(rc.Where(c => c.ChangeType == Dm8DataLocatorChangeType.Deleted).Count() == 1, "Different number of new objects; expected new objects is one");
            Assert.IsTrue(rc.Where(c => c.ChangeType == Dm8DataLocatorChangeType.Changed && c.MainObject.left is Dm8DataLocatorTable).Count() == 4, "Different number of changed objects; expected number of changes is '4'");
            Assert.IsTrue(rc.Where(c => c.ChangeType == Dm8DataLocatorChangeType.Changed && c.MainObject.left is Dm8DataLocatorView).Count() == 1, "Different number of changed objects; expected number of changes is '1'");
        }
    }
}

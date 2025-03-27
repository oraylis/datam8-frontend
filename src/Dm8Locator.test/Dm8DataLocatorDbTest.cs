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

using Dm8DataLocator;
using Dm8DataLocator.Db;
using Dm8DataLocator.Db.TSql;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.Text.Json;

namespace Dm8DataLocatorTest.Base
{
    /// <summary>
    /// Testing Data Resource Locators for database resources
    /// </summary>
    [TestClass]
    public class Dm8DataLocatorDbUnitTest
    {
        /// <summary>
        /// Test Valid Data Resource Locators for database resources
        /// </summary>
        [TestMethod]
        public void JsonSerialize()
        {
            // check table locator
            Dm8DataLocatorTable AdlTable = new Dm8DataLocatorTable("/DWH/Information/Access/Controlling/CostElement");
            Dm8DataLocatorColumn AdlCol = new Dm8DataLocatorColumn("/DWH/Information/Access/Controlling/CostElement/Id");

            // serialize and deserialize
            string AdlTableJson = JsonSerializer.Serialize(AdlTable);
            Dm8DataLocatorBase AdlTableCopy = JsonSerializer.Deserialize<Dm8DataLocatorTable>(AdlTableJson);

            // compare
            Assert.IsTrue(AdlTable == AdlTableCopy, "Serialized object does not match original object");

            // serialize array
            Dm8DataLocatorBase[] Adls = { AdlTable, AdlCol };

            JsonSerializerOptions jsonSerializerOptions = new JsonSerializerOptions
            {
                Converters = { new Dm8DataLocatorJsonConverter() }
            };

            string AdlsJson = JsonSerializer.Serialize(Adls, jsonSerializerOptions);
            Dm8DataLocatorBase[] AdlsCopy = JsonSerializer.Deserialize<Dm8DataLocatorBase[]>(AdlsJson, jsonSerializerOptions);

            // compare array
            Assert.IsTrue(Adls[0] == AdlsCopy[0], "Serialized object does not match original object");
        }

        /// <summary>
        /// Test Valid Data Resource Locators for database resources
        /// </summary>
        [TestMethod]
        public void CompareDm8DataLocators()
        {
            // test different DB resource locators
            Dm8DataLocatorDb AdlDb1 = new Dm8DataLocatorDb("DWH");
            Dm8DataLocatorDb AdlDb2 = new Dm8DataLocatorDb("/DWH");
            Dm8DataLocatorDb AdlDb3 = new Dm8DataLocatorDb("/DWH/");

            // test compare and equal identifier representation
            Assert.IsTrue(AdlDb1 == AdlDb2, $"Identical Dm8DataLocators not equal  {AdlDb1}!= {AdlDb2}");
            Assert.IsTrue(AdlDb2 == AdlDb3, $"Identical Dm8DataLocators not equal  {AdlDb2}!= {AdlDb3}");

            // Compare against null
            Assert.IsTrue(AdlDb1 != null, $"Null comparison failed {AdlDb1}!=null");
            Assert.IsTrue(null != AdlDb1, $"Null comparison failed null!={AdlDb1}");
            Assert.IsFalse(AdlDb1 == null, $"Null comparison failed {AdlDb1}==null");
            Assert.IsFalse(null == AdlDb1, $"Null comparison failed null=={AdlDb1}");
        }

        /// <summary>
        /// Test Valid Data Resource Locators for database resources
        /// </summary>
        [TestMethod]
        public void ValidDm8DataLocators()
        {
            // DB resource locators
            Dm8DataLocatorDb AdlDb = new Dm8DataLocatorDb("DWH");

            // check different DB locator
            _ = new Dm8DataLocatorProcedure("/DWH/Information/Access/Controlling/CalcCostElement");
            _ = new Dm8DataLocatorView("/DWH/Information/Access/Controlling/CostElement");
            Dm8DataLocatorTable AdlTable = new Dm8DataLocatorTable("/DWH/Information/Store/Controlling/CostElement");

            // check column locator
            Dm8DataLocatorColumn AdlCol = new Dm8DataLocatorColumn("/DWH/Information/Store/Controlling/CostElement/Id");

            // test compare operator and parent of column is table
            Assert.IsTrue(AdlCol.Parent == AdlTable, $"Parent of column {AdlCol} != table {AdlTable}");
            Assert.IsTrue(AdlTable.Parent.Parent.Parent.Parent == AdlDb, $"Root of table {AdlTable} is not DB {AdlDb}");
        }

        /// <summary>
        /// Test Invalid Data Resource Locators for database resources
        /// </summary>
        [TestMethod]
        public void InvalidDm8DataLocators()
        {
            // not a table (not enough components)
            bool isTable1 = false;
            string AdlWrongTable1 = "/DWH/Information/Access/CostElement";
            try
            {
                Dm8DataLocatorTable AdlTable = new Dm8DataLocatorTable(AdlWrongTable1);
                isTable1 = true;
            }
            catch
            {
            }
            Assert.IsFalse(isTable1, $"Wrong table Dm8DataLocator not identified {AdlWrongTable1}");

            // not a table (too many components)
            bool isTable2 = false;
            string AdlWrongTable2 = "/DWH/Information/Access/X/Y/CostElement";
            try
            {
                Dm8DataLocatorTable AdlTable = new Dm8DataLocatorTable(AdlWrongTable2);
                isTable2 = true;
            }
            catch
            {
            }
            Assert.IsFalse(isTable2, $"Wrong table Dm8DataLocator not identified {AdlWrongTable2}");
        }
    }
}

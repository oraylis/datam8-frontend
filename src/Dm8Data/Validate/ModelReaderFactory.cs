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
using Dm8Data.Validate.Base;
using Dm8Data.Validate.Generic;

namespace Dm8Data.Validate
{
    public class ModelReaderFactory
    {
        protected static Dictionary<Type, Func<IModelReader>> readerCreator = new Dictionary<Type, Func<IModelReader>>();


        static ModelReaderFactory()
        {
            readerCreator.Add(typeof(AttributeTypes.AttributeType), () => new AttributeTypeModelReader());
            readerCreator.Add(typeof(DataTypes.DataType), () => new DataTypeModelReader());
            readerCreator.Add(typeof(DataSources.DataSource), () => new DataSourceModelReader());
            readerCreator.Add(typeof(DataProducts.DataProduct), () => new DataProductModelReader());
            readerCreator.Add(typeof(Raw.ModelEntry), () => new RawModelReader());
            readerCreator.Add(typeof(Stage.ModelEntry), () => new StageModelReader());
            readerCreator.Add(typeof(Core.ModelEntry), () => new CoreModelReader());
            readerCreator.Add(typeof(Curated.ModelEntry), () => new CuratedModelReader());
            readerCreator.Add(typeof(Diagram.Diagram), () => new DiagramModelReader());

        }

        public static IModelReader Create(Type t)
        {
            return readerCreator[t].Invoke();
        }
    }
}

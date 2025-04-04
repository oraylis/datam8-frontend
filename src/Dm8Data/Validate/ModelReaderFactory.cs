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

CREATE TABLE [dbo].[FactProductInventory] (
    [ProductKey]   INT   NOT NULL,
    [DateKey]      INT   NOT NULL,
    [MovementDate] DATE  NOT NULL,
    [UnitCost]     MONEY NOT NULL,
    [UnitsIn]      INT   NOT NULL,
    [UnitsOut]     INT   NOT NULL,
    [UnitsBalance] INT   NOT NULL,
    CONSTRAINT [PK_FactProductInventory] PRIMARY KEY CLUSTERED ([ProductKey] ASC, [DateKey] ASC),
    CONSTRAINT [FK_FactProductInventory_DimDate] FOREIGN KEY ([DateKey]) REFERENCES [dbo].[DimDate] ([DateKey]),
    CONSTRAINT [FK_FactProductInventory_DimProduct] FOREIGN KEY ([ProductKey]) REFERENCES [dbo].[DimProduct] ([ProductKey])
);


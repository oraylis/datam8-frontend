CREATE TABLE [dbo].[DimSalesTerritory] (
    [SalesTerritoryKey]          INT             IDENTITY (1, 1) NOT NULL,
    [SalesTerritoryAlternateKey] INT             NULL,
    [SalesTerritoryRegion]       NVARCHAR (50)   NOT NULL,
    [SalesTerritoryCountry]      NVARCHAR (50)   NOT NULL,
    [SalesTerritoryGroup]        NVARCHAR (50)   NULL,
    [SalesTerritoryImage]        VARBINARY (MAX) NULL,
    CONSTRAINT [PK_DimSalesTerritory_SalesTerritoryKey] PRIMARY KEY CLUSTERED ([SalesTerritoryKey] ASC),
    CONSTRAINT [AK_DimSalesTerritory_SalesTerritoryAlternateKey] UNIQUE NONCLUSTERED ([SalesTerritoryAlternateKey] ASC)
);


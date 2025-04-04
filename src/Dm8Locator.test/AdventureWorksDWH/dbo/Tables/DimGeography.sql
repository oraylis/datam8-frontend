CREATE TABLE [dbo].[DimGeography] (
    [GeographyKey]             INT           IDENTITY (1, 1) NOT NULL,
    [City]                     NVARCHAR (30) NULL,
    [StateProvinceCode]        NVARCHAR (3)  NULL,
    [StateProvinceName]        NVARCHAR (50) NULL,
    [CountryRegionCode]        NVARCHAR (3)  NULL,
    [EnglishCountryRegionName] NVARCHAR (50) NULL,
    [SpanishCountryRegionName] NVARCHAR (50) NULL,
    [FrenchCountryRegionName]  NVARCHAR (50) NULL,
    [PostalCode]               NVARCHAR (15) NULL,
    [SalesTerritoryKey]        INT           NULL,
    [IpAddressLocator]         NVARCHAR (15) NULL,
    CONSTRAINT [PK_DimGeography_GeographyKey] PRIMARY KEY CLUSTERED ([GeographyKey] ASC),
    CONSTRAINT [FK_DimGeography_DimSalesTerritory] FOREIGN KEY ([SalesTerritoryKey]) REFERENCES [dbo].[DimSalesTerritory] ([SalesTerritoryKey])
);


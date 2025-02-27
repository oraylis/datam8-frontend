CREATE TABLE [dbo].[DimProductCategory] (
    [ProductCategoryKey]          INT           IDENTITY (1, 1) NOT NULL,
    [ProductCategoryAlternateKey] INT           NULL,
    [EnglishProductCategoryName]  NVARCHAR (50) NOT NULL,
    [SpanishProductCategoryName]  NVARCHAR (50) NOT NULL,
    [FrenchProductCategoryName]   NVARCHAR (50) NOT NULL,
    CONSTRAINT [PK_DimProductCategory_ProductCategoryKey] PRIMARY KEY CLUSTERED ([ProductCategoryKey] ASC),
    CONSTRAINT [AK_DimProductCategory_ProductCategoryAlternateKey] UNIQUE NONCLUSTERED ([ProductCategoryAlternateKey] ASC)
);


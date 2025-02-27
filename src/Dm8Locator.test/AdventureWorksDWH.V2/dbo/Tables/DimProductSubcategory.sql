CREATE TABLE [dbo].[DimProductSubcategory] (
    [ProductSubcategoryKey]          INT           IDENTITY (1, 1) NOT NULL,
    [ProductSubcategoryAlternateKey] INT           NULL,
    [EnglishProductSubcategoryName]  NVARCHAR (50) NOT NULL,
    [SpanishProductSubcategoryName]  NVARCHAR (50) NOT NULL,
    [FrenchProductSubcategoryName]   NVARCHAR (50) NOT NULL,
    [ProductCategoryKey]             INT           NULL,
    CONSTRAINT [PK_DimProductSubcategory_ProductSubcategoryKey] PRIMARY KEY CLUSTERED ([ProductSubcategoryKey] ASC),
    CONSTRAINT [FK_DimProductSubcategory_DimProductCategory] FOREIGN KEY ([ProductCategoryKey]) REFERENCES [dbo].[DimProductCategory] ([ProductCategoryKey]),
    CONSTRAINT [AK_DimProductSubcategory_ProductSubcategoryAlternateKey] UNIQUE NONCLUSTERED ([ProductSubcategoryAlternateKey] ASC)
);


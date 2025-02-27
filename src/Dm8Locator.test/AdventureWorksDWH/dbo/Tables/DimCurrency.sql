CREATE TABLE [dbo].[DimCurrency] (
    [CurrencyKey]          INT           IDENTITY (1, 1) NOT NULL,
    [CurrencyAlternateKey] NCHAR (3)     NOT NULL,
    [CurrencyName]         NVARCHAR (50) NOT NULL,
    CONSTRAINT [PK_DimCurrency_CurrencyKey] PRIMARY KEY CLUSTERED ([CurrencyKey] ASC)
);


GO
CREATE UNIQUE NONCLUSTERED INDEX [AK_DimCurrency_CurrencyAlternateKey]
    ON [dbo].[DimCurrency]([CurrencyAlternateKey] ASC);


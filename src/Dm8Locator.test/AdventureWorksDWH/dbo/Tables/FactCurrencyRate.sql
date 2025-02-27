CREATE TABLE [dbo].[FactCurrencyRate] (
    [CurrencyKey]  INT        NOT NULL,
    [DateKey]      INT        NOT NULL,
    [AverageRate]  FLOAT (53) NOT NULL,
    [EndOfDayRate] FLOAT (53) NOT NULL,
    [Date]         DATETIME   NULL,
    CONSTRAINT [PK_FactCurrencyRate_CurrencyKey_DateKey] PRIMARY KEY CLUSTERED ([CurrencyKey] ASC, [DateKey] ASC),
    CONSTRAINT [FK_FactCurrencyRate_DimCurrency] FOREIGN KEY ([CurrencyKey]) REFERENCES [dbo].[DimCurrency] ([CurrencyKey]),
    CONSTRAINT [FK_FactCurrencyRate_DimDate] FOREIGN KEY ([DateKey]) REFERENCES [dbo].[DimDate] ([DateKey])
);


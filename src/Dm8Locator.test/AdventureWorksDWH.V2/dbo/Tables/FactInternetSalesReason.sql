CREATE TABLE [dbo].[FactInternetSalesReason] (
    [SalesOrderNumber]     NVARCHAR (20) NOT NULL,
    [SalesOrderLineNumber] TINYINT       NOT NULL,
    [SalesReasonKey]       INT           NOT NULL,
    CONSTRAINT [PK_FactInternetSalesReason_SalesOrderNumber_SalesOrderLineNumber_SalesReasonKey] PRIMARY KEY CLUSTERED ([SalesOrderNumber] ASC, [SalesOrderLineNumber] ASC, [SalesReasonKey] ASC),
    CONSTRAINT [FK_FactInternetSalesReason_DimSalesReason] FOREIGN KEY ([SalesReasonKey]) REFERENCES [dbo].[DimSalesReason] ([SalesReasonKey]),
    CONSTRAINT [FK_FactInternetSalesReason_FactInternetSales] FOREIGN KEY ([SalesOrderNumber], [SalesOrderLineNumber]) REFERENCES [dbo].[FactInternetSales] ([SalesOrderNumber], [SalesOrderLineNumber])
);


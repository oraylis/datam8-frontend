CREATE TABLE [dbo].[DimSalesReason] (
    [SalesReasonKey]          INT           IDENTITY (1, 1) NOT NULL,
    [SalesReasonAlternateKey] INT           NOT NULL,
    [SalesReasonName]         NVARCHAR (50) NOT NULL,
    [SalesReasonReasonType]   NVARCHAR (50) NOT NULL,
    CONSTRAINT [PK_DimSalesReason_SalesReasonKey] PRIMARY KEY CLUSTERED ([SalesReasonKey] ASC)
);


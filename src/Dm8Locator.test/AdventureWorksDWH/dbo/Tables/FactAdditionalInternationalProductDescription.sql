CREATE TABLE [dbo].[FactAdditionalInternationalProductDescription] (
    [ProductKey]         INT            NOT NULL,
    [CultureName]        NVARCHAR (50)  NOT NULL,
    [ProductDescription] NVARCHAR (MAX) NOT NULL,
    CONSTRAINT [PK_FactAdditionalInternationalProductDescription_ProductKey_CultureName] PRIMARY KEY CLUSTERED ([ProductKey] ASC, [CultureName] ASC)
);


CREATE TABLE [dbo].[DimAccount] (
    [AccountKey]                    INT            IDENTITY (1, 1) NOT NULL,
    [ParentAccountKey]              INT            NULL,
    [AccountCodeAlternateKey]       INT            NULL,
    [ParentAccountCodeAlternateKey] INT            NULL,
    [AccountDescription]            NVARCHAR (50)  NULL,
    [AccountType]                   NVARCHAR (50)  NULL,
    [Operator]                      NVARCHAR (50)  NULL,
    [CustomMembers]                 NVARCHAR (300) NULL,
    [ValueType]                     NVARCHAR (50)  NULL,
    [CustomMemberOptions]           NVARCHAR (200) NULL,
    CONSTRAINT [PK_DimAccount] PRIMARY KEY CLUSTERED ([AccountKey] ASC),
    CONSTRAINT [FK_DimAccount_DimAccount] FOREIGN KEY ([ParentAccountKey]) REFERENCES [dbo].[DimAccount] ([AccountKey])
);


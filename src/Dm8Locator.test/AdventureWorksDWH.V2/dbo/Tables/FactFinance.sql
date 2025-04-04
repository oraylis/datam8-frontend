CREATE TABLE [dbo].[FactFinance] (
    [FinanceKey]         INT        IDENTITY (1, 1) NOT NULL,
    [DateKey]            INT        NOT NULL,
    [OrganizationKey]    INT        NOT NULL,
    [DepartmentGroupKey] INT        NOT NULL,
    [ScenarioKey]        INT        NOT NULL,
    [AccountKey]         INT        NOT NULL,
    [Amount]             FLOAT (53) NOT NULL,
    [AmountNumeric]      Numeric (20,2) NOT NULL,
    [Date]               DATETIME   NULL,
    CONSTRAINT [FK_FactFinance_DimAccount] FOREIGN KEY ([AccountKey]) REFERENCES [dbo].[DimAccount] ([AccountKey]),
    CONSTRAINT [FK_FactFinance_DimDate] FOREIGN KEY ([DateKey]) REFERENCES [dbo].[DimDate] ([DateKey]),
    CONSTRAINT [FK_FactFinance_DimDepartmentGroup] FOREIGN KEY ([DepartmentGroupKey]) REFERENCES [dbo].[DimDepartmentGroup] ([DepartmentGroupKey]),
    CONSTRAINT [FK_FactFinance_DimOrganization] FOREIGN KEY ([OrganizationKey]) REFERENCES [dbo].[DimOrganization] ([OrganizationKey]),
);


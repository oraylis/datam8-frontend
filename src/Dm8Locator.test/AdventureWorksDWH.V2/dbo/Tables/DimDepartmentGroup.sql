CREATE TABLE [dbo].[DimDepartmentGroup] (
    [DepartmentGroupKey]       INT           IDENTITY (1, 1) NOT NULL,
    [ParentDepartmentGroupKey] INT           NULL,
    [DepartmentGroupName]      NVARCHAR (50) NULL,
    CONSTRAINT [PK_DimDepartmentGroup] PRIMARY KEY CLUSTERED ([DepartmentGroupKey] ASC),
    CONSTRAINT [FK_DimDepartmentGroup_DimDepartmentGroup] FOREIGN KEY ([ParentDepartmentGroupKey]) REFERENCES [dbo].[DimDepartmentGroup] ([DepartmentGroupKey])
);


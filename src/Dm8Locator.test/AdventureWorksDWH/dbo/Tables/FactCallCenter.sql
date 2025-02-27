CREATE TABLE [dbo].[FactCallCenter] (
    [FactCallCenterID]    INT           IDENTITY (1, 1) NOT NULL,
    [DateKey]             INT           NOT NULL,
    [WageType]            NVARCHAR (15) NOT NULL,
    [Shift]               NVARCHAR (20) NOT NULL,
    [LevelOneOperators]   SMALLINT      NOT NULL,
    [LevelTwoOperators]   SMALLINT      NOT NULL,
    [TotalOperators]      SMALLINT      NOT NULL,
    [Calls]               INT           NOT NULL,
    [AutomaticResponses]  INT           NOT NULL,
    [Orders]              INT           NOT NULL,
    [IssuesRaised]        SMALLINT      NOT NULL,
    [AverageTimePerIssue] SMALLINT      NOT NULL,
    [ServiceGrade]        FLOAT (53)    NOT NULL,
    [Date]                DATETIME      NULL,
    CONSTRAINT [PK_FactCallCenter_FactCallCenterID] PRIMARY KEY CLUSTERED ([FactCallCenterID] ASC),
    CONSTRAINT [FK_FactCallCenter_DimDate] FOREIGN KEY ([DateKey]) REFERENCES [dbo].[DimDate] ([DateKey]),
    CONSTRAINT [AK_FactCallCenter_DateKey_Shift] UNIQUE NONCLUSTERED ([DateKey] ASC, [Shift] ASC)
);


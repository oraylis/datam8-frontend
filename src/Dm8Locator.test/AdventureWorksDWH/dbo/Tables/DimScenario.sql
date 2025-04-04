CREATE TABLE [dbo].[DimScenario] (
    [ScenarioKey]  INT           IDENTITY (1, 1) NOT NULL,
    [ScenarioName] NVARCHAR (50) NULL,
    CONSTRAINT [PK_DimScenario] PRIMARY KEY CLUSTERED ([ScenarioKey] ASC)
);


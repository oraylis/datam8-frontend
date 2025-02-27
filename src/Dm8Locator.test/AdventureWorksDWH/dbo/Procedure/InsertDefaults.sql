CREATE PROCEDURE [dbo].[InsertDefaults]
	@param1 int = 0,
	@param2 int
AS
BEGIN
	UPDATE [dbo].[AdventureWorksDWBuildVersion]
	SET [DBVersion] = '1.0',
		[VersionDate] = '2021-01-01'

	RETURN 0
END
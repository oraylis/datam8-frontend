


-- ******************************************************
-- Create User Defined Functions
-- ******************************************************
-- Builds an ISO 8601 format date from a year, month, and day specified as integers.
-- This format of date should parse correctly regardless of SET DATEFORMAT and SET LANGUAGE.
-- See SQL Server Books Online for more details.
CREATE FUNCTION [dbo].[udfBuildISO8601Date] (@year int, @month int, @day int)
RETURNS datetime
AS 
BEGIN
	RETURN cast(convert(varchar, @year) + '-' + [dbo].[udfTwoDigitZeroFill](@month) 
	    + '-' + [dbo].[udfTwoDigitZeroFill](@day) + 'T00:00:00' 
	    as datetime);
END;

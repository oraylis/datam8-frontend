

CREATE FUNCTION [dbo].[udfMinimumDate] (
    @x DATETIME, 
    @y DATETIME
) RETURNS DATETIME
AS
BEGIN
    DECLARE @z DATETIME

    IF @x <= @y 
        SET @z = @x 
    ELSE 
        SET @z = @y

    RETURN(@z)
END;

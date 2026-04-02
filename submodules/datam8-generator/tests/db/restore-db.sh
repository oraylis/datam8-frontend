#!/bin/bash
sleep 30

DUMMY_PW="datam8abc#1"
DB_VERSION="2017"
DB_NAME="AdventureWorks"
DB_NAME_EXT="${DB_NAME}LT"

/opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P $DUMMY_PW -Q "
USE [master];
GO

RESTORE DATABASE [$DB_NAME]
FROM DISK = '/backup/${DB_NAME_EXT}2017.bak'
WITH
    MOVE '${DB_NAME_EXT}2012_Data' TO '/var/opt/mssql/data/${DB_NAME}_Data.mdf',
    MOVE '${DB_NAME_EXT}2012_log' TO '/var/opt/mssql/data/${DB_NAME}_log.ldf',
    FILE = 1,
    NOUNLOAD,
    STATS = 5;
GO
"

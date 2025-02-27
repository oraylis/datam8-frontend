# databricks-lake

This is a generator designed to produce the necessary files for an ELT (Extract, Load, Transform) flow with Databricks on Azure, enabling data writing to an Azure Data Lake Gen 2.

The generator's templates create Databricks notebooks and Databricks jobs.

## Databricks notebooks

The notebooks are organized into different zones and are categorized based on whether they contain Data Definition Language (DDL) or Data Modeling Language (DML).

### 000 Utils

The Utils section is not representative of a zone in the data lake but rather serves as a location for utility notebooks, including the **logging framework**. For more information on the logging framework, refer to this 📜[guide](docs/logging-framework.md).

### 010 RAW

The RAW zone primarily contains data as it is delivered from the source. There are no DDLs present to allow for schema evolution. The generated DML notebooks extract data from a source system and write it as a Delta Table to an Azure Data Lake Gen 2. The partitioned table is categorized by `year`, `month`, `day`, and `__InsertTimestampUTC`. If a column of the source table is marked as a delta criterion (tagged with `delta`), the generated notebook checks the already loaded data and only loads the newly arrived delta from the source. Supported source systems include Azure SQL Database and Azure Data Lake Gen 2 with Parquet-files.

### 020 STAGE

In the STAGE zone, the DDL notebooks define tables with specific columns and data types as defined in the model. The DML notebooks identify the delta between RAW and STAGE and attempt to load the missing data. Only the columns from the model definition are selected, and all columns are cast to their defined data types. Any rows containing data that does not conform to the definition are written to a poison table. The poison table's name corresponds to the relevant STAGE table, with `_poison` appended to its name.

## Databricks jobs

The Databricks jobs are responsible for orchestrating the ELT process and provide a means for running the notebooks. Currently, the following tasks are supported with these jobs:

- Generation of STAGE tables
- Transport from the source system up to the STAGE table

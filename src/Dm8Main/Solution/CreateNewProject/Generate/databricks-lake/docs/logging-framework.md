# Logging Framework

## Structure

The Logging Framework provides basic capabilities to monitor the status of ELT processes. It differentiates between Loads and Extractions.

A Load represents a set of operations to load data into a table e.g., load a customer table in the CORE zone.
An Extraction on the other hand represents just the retrieval of data from a source system.

Both tables are present in the `logging` schema after the **Logging Framework** got prepared.

### Load table

Example table:

| Load_UUID                            | Target_Zone | Job_name                                          | Start_Time_UTC          | Update_Time_UTC         | End_Time_UTC            | Status                  |
| ------------------------------------ | ----------- | ------------------------------------------------- | ----------------------- | ----------------------- | ----------------------- | ----------------------- |
| 358cb546-1861-4413-ae20-49ad696816da | core        | Load_core_Sales_Customer_Customer                 | 2023-10-26 12:07:30.723 | 2023-10-26 12:08:50.450 | 2023-10-26 12:08:50.450 | Completed               |
| 956ea80c-6500-4a99-a3fe-7700535179e7 | core        | Load_core_Sales_Customer_Customer                 | 2023-10-26 11:49:04.165 | 2023-10-26 11:49:49.741 | -                       | Started CORE processing |
| f7e332a1-a7d9-4e1f-a4c3-19697f039cca | stage       | Load_Sales_Product_ProductModelProductDescription | 2023-10-26 07:20:20.860 | 2023-10-26 07:22:12.038 | 2023-10-26 07:22:12.038 | Completed               |

- `Load_UUID` is a unique identifier for a load
- `Target_Zone` is the final zone, that the load targets
- `Job_Name` represents the Databricks job, that started the load
- `Start_Time_UTC` time in UTC when the load was started
- `Update_Time_UTC` time in UTC when the load status last was updated
- `End_Time_UTC` time in UTC when the load ended
- `Status` message containing current status information for the load

The `Load_UUID` gets attached to every record that was touched during the load. Therefore, the load table can directly get linked to a data table to see the records from a specific load.

The `Load_UUID` gets generated at the start of a Databricks job and is used in every notebook to update the corresponding status.

### Extraction table

Example table:

| Extraction_UUID                      | Table_Name                                       | Start_Time_UTC          | End_Time_UTC            | Row_Count |
| ------------------------------------ | ------------------------------------------------ | ----------------------- | ----------------------- | --------- |
| b97102b1-04c4-4197-b868-45b7379cfb0c | RAW_Sales_Product_ProductModelProductDescription | 2023-10-26 07:21:07.682 | 2023-10-26 07:21:25.912 | 762       |
| cf50a3a9-7ac6-43d3-a774-f9d9b0a49d30 | STAGE_Sales_Other_Address_poison                 | 2023-10-26 07:20:14.296 | 2023-10-26 07:20:18.843 | 439       |

- `Extraction_UUID` is a unique identifier for an extraction
- `Table_Name` is the table that got extracted
- `Start_Time_UTC` time in UTC when the extraction was started
- `End_Time_UTC` time in UTC when the extraction ended
- `Row_Count` amount of rows, that got extracted

The `Extraction_UUID` gets attached to every record that got extracted during the extraction. Therefore, the extraction table can directly get linked to a data table to see the records from a specific extraction.
Also, the `Extraction_UUID` gets transferred to every following layer to have a consistent lineage on every record.

The `Extraction_UUID` gets generated inside of an extraction notebook. This holds true for extractions to **RAW** as well as for extractions into a poison records table.

## Usage

To utilize the **Logging Framework** you just need to install it. Everything else is already handled within the generated notebooks and jobs.

### Installation

To install the **Logging Framework**, simply import the notebook with `%run 000-utils/LoggingFramework` and then execute `LoggingFramework.prepare_logging_framework()`.

### Uninstall

To uninstall the **Logging Framework**, simply import the notebook with `%run 000-utils/LoggingFramework` and then execute `LoggingFramework.remove_logging_framework()`.

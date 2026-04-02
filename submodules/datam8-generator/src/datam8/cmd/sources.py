# DataM8
# Copyright (C) 2024-2025 ORAYLIS GmbH
#
# This file is part of DataM8.
#
# DataM8 is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# DataM8 is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program. If not, see <https://www.gnu.org/licenses/>.

from datetime import UTC, datetime

import typer

from datam8 import factory, logging, opts, utils

from . import common

logger = logging.getLogger(__name__)

app = typer.Typer(
    name="sources",
    help="Subcommands to connect with and view sources",
    no_args_is_help=True,
    context_settings={
        "help_option_names": ["-h", "--help"],
    },
)


@app.command()
def list_tables(
    data_source_name: opts.DataSource,
    solution_path: opts.SolutionPath,
    schema_name: opts.SchemaName = None,
    log_level: opts.LogLevel = opts.LogLevels.WARNING,
    version: opts.Version = False,
):
    "List available source tables"
    common.main_callback(solution_path, log_level, version)

    plugin = factory.get_plugin_for_data_source(data_source_name)
    tables = plugin.list_tables(schema_name)

    typer.echo(f"Found {len(tables.rows())} source objects")
    tables.show(None, tbl_hide_column_data_types=True, tbl_hide_dataframe_shape=True)


@app.command()
def list_schemas(
    data_source_name: opts.DataSource,
    solution_path: opts.SolutionPath,
    log_level: opts.LogLevel = opts.LogLevels.WARNING,
    version: opts.Version = False,
):
    "List availabe sources schemas"
    common.main_callback(solution_path, log_level, version)

    plugin = factory.get_plugin_for_data_source(data_source_name)
    schemas = plugin.list_schemas()

    typer.echo(f"Found {len(schemas.rows())} schemas")
    schemas.show(None, tbl_hide_column_data_types=True, tbl_hide_dataframe_shape=True)


@app.command()
def preview(
    data_source_name: opts.DataSource,
    table_name: opts.TableName,
    solution_path: opts.SolutionPath,
    schema_name: opts.SchemaName = None,
    limit: opts.Limit = 10,
    col_limit: opts.ColLimit = None,
    log_level: opts.LogLevel = opts.LogLevels.WARNING,
    version: opts.Version = False,
):
    "List available plugins"
    common.main_callback(solution_path, log_level, version)

    plugin = factory.get_plugin_for_data_source(data_source_name)
    preview = plugin.preview_data(table_name, schema_name, limit=limit)

    for df in preview.collect_batches(chunk_size=limit):
        df.show(
            limit=limit,
            tbl_hide_dataframe_shape=True,
            tbl_cols=col_limit or len(preview.collect_schema().names()),
        )

        # since the limit is pushed down to the source, there will be only one batch
        # batches are mostly used to safely get a dataframe from a LazyFrame
        raise typer.Exit(0)

    typer.echo(f"No data found in {table_name}")


@app.command("import")
def import_(
    data_source_name: opts.DataSource,
    table_name: opts.TableName,
    locator: opts.Locator,
    solution_path: opts.SolutionPath,
    schema_name: opts.SchemaName = None,
    log_level: opts.LogLevel = opts.LogLevels.WARNING,
    version: opts.Version = False,
):
    "Import a table from a source into the model at the provided locator"
    common.main_callback(solution_path, log_level, version)

    model_ = factory.get_model()
    if model_.has_locator(locator):
        raise utils.create_error("Entity already exists for this locator")

    pm = factory.get_plugin_for_data_source(data_source_name)
    metadata = pm.get_table_metadata(table_name, schema_name)
    _ = model_.add_entity(
        locator,
        content={
            "sources": [
                {
                    "dataSource": data_source_name,
                    "sourceLocation": f"[{schema_name}].[{table_name}]",
                }
            ],
            "attributes": [
                {
                    "ordinalNumber": 1,
                    "name": row[0],
                    "attributeType": "Generic String",
                    "dataType": {
                        "type": row[4],
                        "nullable": True if row[2] == "YES" else False,
                    },
                    "dateAdded": datetime.now(UTC),
                }
                for row in metadata.rows()
            ],
            "transformations": [],
            "relationships": [],
        },
    )
    model_.save(locator)

    typer.echo(f"Source table imported into model at {locator}")


@app.command()
def table_metadata(
    data_source_name: opts.DataSource,
    table_name: opts.TableName,
    solution_path: opts.SolutionPath,
    schema_name: opts.SchemaName = None,
    log_level: opts.LogLevel = opts.LogLevels.WARNING,
    version: opts.Version = False,
):
    "Retrieve table metadata from a source"
    common.main_callback(solution_path, log_level, version)

    plugin = factory.get_plugin_for_data_source(data_source_name)
    metadata = plugin.get_table_metadata(table_name, schema_name)
    metadata.show(
        limit=None,
        tbl_hide_dataframe_shape=True,
        tbl_cols=len(metadata.columns),
    )


@app.command()
def test_connection(
    data_source_name: opts.DataSource,
    solution_path: opts.SolutionPath,
    log_level: opts.LogLevel = opts.LogLevels.WARNING,
    version: opts.Version = False,
):
    "Validate connectionstring and try connecting to the source"
    common.main_callback(solution_path, log_level, version)

    plugin = factory.get_plugin_for_data_source(data_source_name)
    plugin.test_connection()

    typer.echo("Datasource tested successfully")

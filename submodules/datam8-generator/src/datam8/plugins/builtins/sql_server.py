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
import functools
import urllib.parse
from typing import Any

import polars as pl
import typer

from datam8 import config, logging, utils
from datam8.plugins.base import Plugin
from datam8_model.data_source import (
    AuthMode,
    ConnectionProperty,
    ConnectionPropertyValueType,
    DataSource,
    DataSourceType,
    SourceDataTypeMapping,
)
from datam8_model.plugin import Capability, PluginManifest

try:
    import connectorx as _  # noqa: F401
except ModuleNotFoundError as err:
    typer.echo("Required modules for SQL Server Plugin not installed - Install the 'sql' extra")
    raise typer.Exit(1) from err


logger = logging.getLogger(__name__)

manifest = PluginManifest(
    id="builtin:SQLServer",
    displayName="SQL Server (built-in)",
    version=config.get_version(),
    entryPoint="datam8.plugins.builtins.sql_server:SqlServer",
    capabilities=[
        Capability.METADATA,
        Capability.UI_SCHEMA,
        Capability.VALIDATION_CONNECTION,
    ],
)


class SqlServer(Plugin):
    """
    Plugin to interact with MS SQL Server. The connection is done using polars and connector-x which
    does not rely on any further packages or drivers at uses pyArrow internally.
    """

    __manifest: PluginManifest = manifest

    def __init__(
        self, manifest: PluginManifest, /, data_source: DataSource, data_source_type: DataSourceType
    ) -> None:
        super().__init__(manifest, data_source, data_source_type)
        SqlServer.validate_connection(data_source, data_source_type)

        self.logger.debug(f"Properties: {self.extended_properties}")

    def get_connection_string(self) -> str:
        mandatory: dict[str, Any] = {}
        optional: dict[str, Any] = {}

        for cp in self.get_connection_properties():
            match [cp.required, cp.default, cp.name]:
                case [True, _, _]:
                    mandatory[cp.name] = self.extended_properties[cp.name]
                case [False, None, name] if name in self.extended_properties:
                    optional[name] = self.extended_properties[name]
                case [False, _ as default, _ as name] if name in self.extended_properties:
                    optional[name] = self.extended_properties.get(name, default)

        match mandatory:
            case {"authMode": "sql_user", **rest}:  # noqa: F841
                assert "password" in optional
                assert "username" in optional

                mandatory["username"] = optional.pop("username")
                mandatory["password"] = urllib.parse.quote_plus(optional.pop("password"))

                uri = "mssql://{username}:{password}@{host}:{port}/{database}"

            case {"authMode": "windows", **rest}:  # noqa: F841
                assert "trusted_connection" in optional

                uri = "mssql://@{host}:{port}/{database}"

            case {"authMode": _ as auth_mode, **rest}:  # noqa: F841
                raise utils.create_error(
                    ValueError(f"Unkown authMode {auth_mode} in {self._data_source.name}")
                )

        uri = uri.format(**mandatory)

        if len(optional) > 0:
            uri += "?" + "&".join([f"{k}={v}" for k, v in optional.items()])

        masked_uri = uri
        for cp in self.get_connection_properties():
            if (
                cp.name in {**mandatory, **optional}
                and cp.type == ConnectionPropertyValueType.SECRET
            ):
                to_replace = mandatory.get(cp.name, optional.get(cp.name))
                masked_uri = masked_uri.replace(to_replace, "*****")

        self.logger.debug(f"Created connection string: {masked_uri}")

        return uri

    def _execute_query(self, query: str, /, pre_execution_query: list[str] = []) -> pl.DataFrame:
        uri = self.get_connection_string()
        try:
            self.logger.debug(f"Executing: {query}")
            result = pl.read_database_uri(query, uri, pre_execution_query=pre_execution_query)
            self.logger.debug(f"Result: {result}")
            return result
        except Exception as err:
            raise utils.create_error(err)

    def test_connection(self) -> Exception | None:
        result = self._execute_query("select 'connected' as [status]")
        if isinstance(result, Exception):
            return result
        return None

    def list_schemas(self) -> pl.DataFrame:
        database = (self._data_source.extendedProperties or {})["database"]
        query = f"""
            select
                schema_name as [schema]
            from
                [information_schema].[schemata]
            where 1=1
                and catalog_name = '{database}'
        """

        result = self._execute_query(query)
        return result

    def list_tables(self, schema: str | None = None) -> pl.DataFrame:
        database = (self._data_source.extendedProperties or {})["database"]

        query = f"""
            select
                table_schema as [schema],
                table_name as [name],
                table_type as [type]
            from [information_schema].[tables]
            where 1=1
                and table_catalog = '{database}'
        """
        if schema is not None:
            query += f" and table_schema = '{schema}'"

        return self._execute_query(query)

    def preview_data(
        self, table: str, /, schema: str | None = None, *, limit: int = 10
    ) -> pl.LazyFrame:
        if schema is None:
            raise utils.create_error("A schema needs to be provided for SQL Server sources")

        query = f"select top {limit} * from [{schema}].[{table}]"
        return self._execute_query(query).lazy()

    def get_table_metadata(self, table: str, schema: str | None = None) -> pl.DataFrame:
        if schema is None:
            raise utils.create_error("A schema needs to be provided for SQL Server sources")

        query = f"""
            select
                c.*,
                case when pk.[COLUMN_NAME] is not null then cast(1 as bit) else cast(0 as bit) end as [IS_PRIMARY_KEY]
            from [information_schema].[columns] as c
                left join (
                    select
                        kcu.[TABLE_CATALOG],
                        kcu.[TABLE_SCHEMA],
                        kcu.[TABLE_NAME],
                        kcu.[COLUMN_NAME]
                    from [information_schema].[table_constraints] as tc
                        inner join [information_schema].[key_column_usage] as kcu
                            on tc.[constraint_name] = kcu.[constraint_name]
                            and tc.[table_schema] = kcu.[table_schema]
                    where tc.[constraint_type] = 'PRIMARY KEY'
                ) as pk
                    on c.[TABLE_CATALOG] = pk.[TABLE_CATALOG]
                    and c.[TABLE_SCHEMA] = pk.[TABLE_SCHEMA]
                    and c.[TABLE_NAME] = pk.[TABLE_NAME]
                    and c.[COLUMN_NAME] = pk.[COLUMN_NAME]
            where 1=1
                and c.[table_name] = '{table}'
                and c.[table_schema] = '{schema}'
            order by
                c.[ordinal_position]
        """

        raw_result = self._execute_query(query).to_dicts()
        mapped_rows: list[dict[str, Any]] = []

        def _first_non_null(row: dict[str, Any], keys: list[str]) -> Any:
            for key in keys:
                if key in row and row[key] is not None:
                    return row[key]
            return None

        def _to_nullable_int(value: Any) -> int | None:
            if value is None:
                return None
            if isinstance(value, bool):
                num = int(value)
                return num if num > 0 else None
            if isinstance(value, (int, float)):
                num = int(value)
                return num if num > 0 else None
            raw = str(value).strip()
            if not raw:
                return None
            num = int(raw)
            return num if num > 0 else None

        def _to_bool(value: Any) -> bool:
            if isinstance(value, bool):
                return value
            if isinstance(value, (int, float)):
                return bool(value)
            raw = str(value).strip().lower()
            return raw in {"1", "true", "yes", "y"}

        for row in raw_result:
            name = _first_non_null(row, ["name", "COLUMN_NAME", "column_name"])
            ordinal = _first_non_null(row, ["ordinal", "ORDINAL_POSITION", "ordinal_position"])
            data_type = _first_non_null(row, ["dataType", "DATA_TYPE", "data_type"])
            is_nullable = _first_non_null(row, ["isNullable", "IS_NULLABLE", "is_nullable"])

            if name is None or ordinal is None or data_type is None or is_nullable is None:
                raise utils.create_error(
                    ValueError(
                        f"Invalid source metadata row for [{schema}].[{table}] in '{self._data_source.name}': {row}"
                    )
                )

            ordinal_int = int(_to_nullable_int(ordinal) or 0)
            if ordinal_int < 1:
                raise utils.create_error(
                    ValueError(
                        f"Invalid ordinal in source metadata row for [{schema}].[{table}] in '{self._data_source.name}': {row}"
                    )
                )

            mapped_rows.append(
                {
                    "name": str(name),
                    "ordinal": ordinal_int,
                    "dataType": str(data_type),
                    "maxLength": _to_nullable_int(
                        _first_non_null(
                            row,
                            [
                                "maxLength",
                                "CHARACTER_MAXIMUM_LENGTH",
                                "character_maximum_length",
                            ],
                        )
                    ),
                    "numericPrecision": _to_nullable_int(
                        _first_non_null(row, ["numericPrecision", "NUMERIC_PRECISION", "numeric_precision"])
                    ),
                    "numbericScale": _to_nullable_int(
                        _first_non_null(row, ["numbericScale", "NUMERIC_SCALE", "numeric_scale"])
                    ),
                    "isNullable": _to_bool(is_nullable),
                    "isPrimaryKey": _to_bool(
                        _first_non_null(row, ["isPrimaryKey", "IS_PRIMARY_KEY", "is_primary_key"]) or False
                    ),
                }
            )

        result = pl.DataFrame(mapped_rows)
        if result.is_empty():
            raise utils.create_error(
                f"Table [{schema}].[{table}] does not exist in '{self._data_source.name}'"
            )

        return result

    @classmethod
    def validate_connection(
        cls, data_source: DataSource, /, data_source_type: DataSourceType
    ) -> Exception | None:
        # TODO: implement additional plugin specific validation logics
        return None

    @classmethod
    def manifest(cls) -> PluginManifest:
        return cls.__manifest

    @staticmethod
    @functools.lru_cache(maxsize=1)
    def get_auth_modes() -> list[AuthMode]:
        auth_modes = [
            AuthMode(
                name="sql_user",
                displayName="Username / Password",
                required=["username", "password"],
                optional=["trust_server_certificate", "trust_server_certificate_ca", "encrypt"],
            ),
            AuthMode(
                name="windows",
                displayName="Windows Authentication",
                required=["trusted_connection"],
                optional=["trust_server_certificate", "trust_server_certificate_ca", "encrypt"],
            ),
        ]

        return auth_modes

    @staticmethod
    @functools.lru_cache(maxsize=1)
    def get_connection_properties() -> list[ConnectionProperty]:
        cp = [
            ConnectionProperty(
                name="authMode", type=ConnectionPropertyValueType.STRING, required=True
            ),
            ConnectionProperty(name="host", type=ConnectionPropertyValueType.STRING, required=True),
            ConnectionProperty(
                name="database", type=ConnectionPropertyValueType.STRING, required=True
            ),
            ConnectionProperty(
                name="port", type=ConnectionPropertyValueType.NUMBER, required=True, default=1433
            ),
            ConnectionProperty(
                name="username", type=ConnectionPropertyValueType.STRING, required=False
            ),
            ConnectionProperty(
                name="password", type=ConnectionPropertyValueType.SECRET, required=False
            ),
            ConnectionProperty(
                name="trust_server_certificate",
                required=False,
                default=False,
                type=ConnectionPropertyValueType.BOOLEAN,
                description="Trust unverifyable certificates, e.g. self-signed",
            ),
            ConnectionProperty(
                name="trust_server_certificate_ca",
                required=False,
                type=ConnectionPropertyValueType.BOOLEAN,
                description="Path to a root ca to verify the server certificate against",
            ),
            ConnectionProperty(
                name="encrypt",
                required=False,
                default=True,
                type=ConnectionPropertyValueType.BOOLEAN,
                description="Activate SSL encryption",
            ),
            ConnectionProperty(
                name="trusted_connection",
                required=False,
                default=False,
                type=ConnectionPropertyValueType.BOOLEAN,
                description="Enables Windows Authentication",
            ),
        ]
        return cp

    @staticmethod
    @functools.lru_cache(maxsize=1)
    def get_data_type_mappings() -> list[SourceDataTypeMapping]:
        data_types = [
            SourceDataTypeMapping(sourceType="bit", targetType="boolean"),
            # texts
            SourceDataTypeMapping(sourceType="uniqueidentifier", targetType="string"),
            SourceDataTypeMapping(sourceType="varbinary", targetType="string"),
            SourceDataTypeMapping(sourceType="varchar", targetType="string"),
            SourceDataTypeMapping(sourceType="xml", targetType="string"),
            SourceDataTypeMapping(sourceType="sql_variant", targetType="string"),
            SourceDataTypeMapping(sourceType="text", targetType="text"),
            SourceDataTypeMapping(sourceType="timestamp", targetType="string"),
            SourceDataTypeMapping(sourceType="nvarchar", targetType="string"),
            SourceDataTypeMapping(sourceType="nchar", targetType="string"),
            SourceDataTypeMapping(sourceType="ntext", targetType="string"),
            SourceDataTypeMapping(sourceType="image", targetType="string"),
            SourceDataTypeMapping(sourceType="char", targetType="string"),
            SourceDataTypeMapping(sourceType="binary", targetType="string"),
            # numbers
            SourceDataTypeMapping(sourceType="bigint", targetType="long"),
            SourceDataTypeMapping(sourceType="tinyint", targetType="int"),
            SourceDataTypeMapping(sourceType="real", targetType="double"),
            SourceDataTypeMapping(sourceType="smallint", targetType="int"),
            SourceDataTypeMapping(sourceType="smallmoney", targetType="decimal"),
            SourceDataTypeMapping(sourceType="numeric", targetType="decimal"),
            SourceDataTypeMapping(sourceType="int", targetType="int"),
            SourceDataTypeMapping(sourceType="money", targetType="decimal"),
            SourceDataTypeMapping(sourceType="decimal", targetType="decimal"),
            SourceDataTypeMapping(sourceType="float", targetType="double"),
            # dates / times
            SourceDataTypeMapping(sourceType="date", targetType="datetime"),
            SourceDataTypeMapping(sourceType="smalldatetime", targetType="datetime"),
            SourceDataTypeMapping(sourceType="datetime", targetType="datetime"),
            SourceDataTypeMapping(sourceType="datetime2", targetType="datetime"),
            SourceDataTypeMapping(sourceType="datetimeoffset", targetType="datetime"),
            SourceDataTypeMapping(sourceType="time", targetType="datetime"),
        ]
        return data_types

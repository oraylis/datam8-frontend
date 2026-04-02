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

# ruff: noqa: F401

from datam8_model.data_source import DataSourceType

from .base import Plugin
from .builtins.file import CsvFile
from .manager import PluginManager

PluginManager.register_builtin_plugin("CsvFile", CsvFile.manifest())


def register_lake_source() -> None:
    from .builtins.lake_source import AzureDataLake

    PluginManager.register_builtin_plugin("AzureDataLake", AzureDataLake.manifest())


def register_sql_server() -> None:
    from .builtins.sql_server import SqlServer

    PluginManager.register_builtin_plugin("SQLServer", SqlServer.manifest())


def init_builtin_plugins(
    *, data_source_type: DataSourceType | None = None, plugin_id: str | None = None
) -> None:
    possible_type_name = None if data_source_type is None else data_source_type.name
    possible_plugin_id = None if plugin_id is None else plugin_id.removeprefix("builtin:")

    match [possible_type_name, possible_plugin_id]:
        case ["AzureDataLake", None] | [None, "AzureDataLake"]:
            register_lake_source()

        case ["SQLServer", None] | [None, "SQLServer"]:
            register_sql_server()

        case [None, None]:
            register_lake_source()
            register_sql_server()

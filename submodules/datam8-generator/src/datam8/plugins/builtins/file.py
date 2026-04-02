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
from pathlib import Path

import polars as pl

from datam8 import config, logging, utils
from datam8.plugins import Plugin
from datam8_model.data_source import (
    AuthMode,
    ConnectionProperty,
    ConnectionPropertyValueType,
    SourceDataTypeMapping,
)
from datam8_model.plugin import Capability, PluginManifest

logger = logging.getLogger(__name__)

manifest_csv = PluginManifest(
    id="builtin:CsvFile",
    displayName="Local CSV File (builtin)",
    version=config.get_version(),
    entryPoint="datam8.plugins.builtins.file:CsvFile",
    capabilities=[
        Capability.METADATA,
        Capability.UI_SCHEMA,
        Capability.VALIDATION_CONNECTION,
    ],
)


class CsvFile(Plugin):
    __manifest: PluginManifest = manifest_csv

    def _get_path(self) -> Path:
        protocol = self.extended_properties.pop("protocol")
        file_path = self.extended_properties.pop("path")

        match [protocol, file_path]:
            case ["file", path]:
                path = Path(path)
            case [unknown, _]:
                raise utils.create_error(f"Protocol '{unknown}' is not implemented for CsvFiles")
            case _:
                raise utils.create_error("Should not be reached, is a bug...")

        return path

    def test_connection(self) -> Exception | None:
        path = self._get_path()
        if not path.exists():
            raise utils.create_error(
                FileNotFoundError(
                    f"Directory '{path}' for data source '{self._data_source.name}' not found"
                )
            )

    def list_tables(self, schema: str | None = None, /) -> pl.DataFrame:
        data = {
            "schema": None,
            "table": self._get_path().glob("*.csv"),
            "type": "file",
        }
        return pl.DataFrame(data)

    def preview_data(
        self, table_name: str, /, schema: str | None = None, *, limit: int = 10
    ) -> pl.LazyFrame:
        path = self._get_path()
        df = pl.read_csv(path / table_name, sample_size=limit, **self.extended_properties)
        return df.lazy()

    @classmethod
    def manifest(cls) -> PluginManifest:
        return cls.__manifest

    @staticmethod
    @functools.lru_cache(maxsize=1)
    def get_auth_modes() -> list[AuthMode]:
        auth_modes = [
            AuthMode(
                name="no_auth", displayName="No Auth / Anonymouse", required=["path", "protocol"]
            ),
        ]
        return auth_modes

    @staticmethod
    @functools.lru_cache(maxsize=1)
    def get_data_type_mappings() -> list[SourceDataTypeMapping]:
        types = [
            SourceDataTypeMapping(sourceType="string", targetType="string"),
            SourceDataTypeMapping(sourceType="number", targetType="decimal"),
        ]
        return types

    @staticmethod
    @functools.lru_cache(maxsize=1)
    def get_connection_properties() -> list[ConnectionProperty]:
        cps = [
            ConnectionProperty(name="path", required=True, type=ConnectionPropertyValueType.STRING),
            ConnectionProperty(
                name="protocol",
                required=False,
                type=ConnectionPropertyValueType.STRING,
                default="file",
            ),
            ConnectionProperty(
                name="has_header",
                required=False,
                type=ConnectionPropertyValueType.BOOLEAN,
                default=True,
            ),
        ]
        return cps

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

from __future__ import annotations

import abc
import functools
from typing import Any

import polars as pl

from datam8 import logging, utils
from datam8.secrets import SecretResolver
from datam8_model.data_source import (
    AuthMode,
    ConnectionProperty,
    ConnectionPropertyValueType,
    DataSource,
    DataSourceType,
    SourceDataTypeMapping,
)
from datam8_model.plugin import Capability, PluginManifest, UiAuthMode, UiField, UiSchema

VALIDATION_CONNECTION = Capability.VALIDATION_CONNECTION
METADATA = Capability.METADATA
UI_SCHEMA = Capability.UI_SCHEMA

logger = logging.getLogger(__name__)


class MissingCapabilityError(Exception):
    def __init__(self, capability: Capability, data_source: DataSource | None = None):
        self.capability = capability
        self.data_source = data_source
        self.msg = f"Plugin is missing {capability}"

        if self.data_source is not None:
            self.msg += f" in {self.data_source}"

        super().__init__(self.msg)


class Plugin(abc.ABC):
    def __init__(
        self, manifest: PluginManifest, /, data_source: DataSource, data_source_type: DataSourceType
    ) -> None:
        self._manifest: PluginManifest = manifest
        self._data_source: DataSource = data_source
        self._data_source_type: DataSourceType = data_source_type
        self.logger = logging.getLogger(f"datam8.plugins.{data_source.type}.{data_source.name}")

        error = Plugin.validate_connection(data_source, data_source_type)
        if error is not None:
            raise utils.create_error(error)

    def __repr__(self) -> str:
        return f"Plugin(id='{self._manifest.id}' data_source='{self._data_source.name}')"

    @functools.cached_property
    def extended_properties(self) -> dict[str, Any]:
        if not self.is_capable_of(VALIDATION_CONNECTION):
            raise MissingCapabilityError(VALIDATION_CONNECTION)

        assert self._data_source.extendedProperties is not None
        base = dict(self._data_source.extendedProperties)

        for cp in self._data_source_type.connectionProperties:
            if cp.name not in base and cp.default is not None:
                base[cp.name] = cp.default
            if cp.type == ConnectionPropertyValueType.SECRET:
                secret_ref = base.pop(cp.name)
                if not isinstance(secret_ref, str):
                    raise utils.create_error(ValueError("A secret ref needs to be of type string"))

                secret = SecretResolver().get_secret(secret_ref)
                if secret is None:
                    raise utils.create_error(
                        ValueError(f"Could not resolve secret ref: {secret_ref}")
                    )
                base[cp.name] = secret

        return base

    def get_manifest(self) -> PluginManifest:
        return self._manifest

    def test_connection(self) -> Exception | None:
        if not self.is_capable_of(VALIDATION_CONNECTION):
            raise MissingCapabilityError(VALIDATION_CONNECTION)
        raise NotImplementedError(f"test_connection on {self}")

    # TODO: find way to type hint the DataFrame to make plugin development smoother?

    def list_schemas(self) -> pl.DataFrame:
        if not self.is_capable_of(METADATA):
            raise MissingCapabilityError(METADATA)
        raise NotImplementedError(f"list_schemas on {type(self)}")

    def list_tables(self, schema: str | None = None, /) -> pl.DataFrame:
        if not self.is_capable_of(METADATA):
            raise MissingCapabilityError(METADATA)
        raise NotImplementedError(f"list_tables on {type(self)}")

    def get_table_metadata(self, table: str, /, schema: str | None = None) -> pl.DataFrame:
        if not self.is_capable_of(METADATA):
            raise MissingCapabilityError(METADATA)
        raise NotImplementedError(f"get_table_metadata on {type(self)}")

    def preview_data(
        self, table: str, /, schema: str | None = None, *, limit: int = 10
    ) -> pl.LazyFrame:
        raise NotImplementedError(f"preview_data on {type(self)}")

    @classmethod
    def is_capable_of(cls, capability: Capability, /) -> bool:
        return capability in cls.manifest().capabilities

    @classmethod
    def validate_connection(
        cls, data_source: DataSource, /, data_source_type: DataSourceType
    ) -> Exception | None:
        ds_properties: dict[str, Any] = dict(data_source.extendedProperties)
        dst_properties: dict[str, ConnectionProperty] = {
            cp.name: cp for cp in data_source_type.connectionProperties
        }
        additional_properties: list[str] = []
        missing_properties: list[str] = []

        for prop in ds_properties:
            if prop not in dst_properties:
                additional_properties.append(prop)

        for cp in dst_properties.values():
            if cp.name not in ds_properties and cp.required and cp.default is None:
                missing_properties.append(cp.name)

        if len(additional_properties) > 0:
            logger.warning(
                f"Additional properties detected in data source '{data_source.name}': {additional_properties}"
            )

        if len(missing_properties) > 0:
            return Exception(
                f"Missing required properties in data source '{data_source.name}': {missing_properties}"
            )

        return None

    @classmethod
    @abc.abstractmethod
    def manifest(cls) -> PluginManifest: ...

    @classmethod
    def get_ui_schema(cls) -> UiSchema:
        manifest = cls.manifest()

        ui_schema = UiSchema(
            title=manifest.displayName or manifest.id,
            authModes=[
                UiAuthMode(
                    id=auth_mode.name,
                    label=auth_mode.displayName,
                    fields=[
                        UiField(
                            key=cp.name,
                            label=cp.displayName,
                            type=cp.type.value,
                            required=cp.name in auth_mode.required,
                            default=cp.default,
                        )
                        for cp in cls.get_connection_properties()
                        if cp.name in auth_mode.required
                        or cp.name in (auth_mode.optional or [])
                        or cp.required
                    ],
                )
                for auth_mode in cls.get_auth_modes()
            ],
        )

        return ui_schema

    @staticmethod
    @functools.lru_cache
    @abc.abstractmethod
    def get_auth_modes() -> list[AuthMode]: ...

    @staticmethod
    @functools.lru_cache
    @abc.abstractmethod
    def get_connection_properties() -> list[ConnectionProperty]: ...

    @staticmethod
    @functools.lru_cache
    @abc.abstractmethod
    def get_data_type_mappings() -> list[SourceDataTypeMapping]: ...

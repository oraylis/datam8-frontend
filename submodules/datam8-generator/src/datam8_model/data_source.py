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

from collections.abc import Mapping, Sequence
from enum import Enum
from pathlib import Path
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field

from . import property


class SourceDataTypeMapping(BaseModel):
    """
    A mapping of datatypes name in the source to datam8 internal datatype names.
    """

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        validate_assignment=True,
        revalidate_instances="always",
    )
    sourceType: str
    """
    Source system data type
    """
    targetType: str
    """
    Target system data type
    """

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj: Any) -> SourceDataTypeMapping:
        return SourceDataTypeMapping.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> SourceDataTypeMapping:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        SourceDataTypeMapping
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = SourceDataTypeMapping.model_validate_json(file.read())

        return model

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))


class ConnectionPropertyValueType(Enum):
    STRING = "string"
    NUMBER = "number"
    BOOLEAN = "boolean"
    SECRET = "secret"


class ConnectionProperty(BaseModel):
    """
    A property or setting defined by a data source type, which is then available when defining concrete data sources.
    """

    name: str
    displayName: str | None = None
    required: bool
    description: str | None = None
    type: Annotated[ConnectionPropertyValueType, Field(title="ConnectionPropertyValueType")]
    default: str | bool | int | float | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj: Any) -> ConnectionProperty:
        return ConnectionProperty.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> ConnectionProperty:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        ConnectionProperty
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = ConnectionProperty.model_validate_json(file.read())

        return model

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))


class AuthMode(BaseModel):
    """
    A single authentiocation method
    """

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        validate_assignment=True,
        revalidate_instances="always",
    )
    name: str
    displayName: str | None = None
    required: Annotated[Sequence[str], Field(min_length=1)]
    optional: Sequence[str] | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj: Any) -> AuthMode:
        return AuthMode.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> AuthMode:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        AuthMode
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = AuthMode.model_validate_json(file.read())

        return model

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))


class DataSourceType(BaseModel):
    """
    Defines groups of data sources that base on their technology, e.g. `SqlServer` or `Oracle`
    """

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        validate_assignment=True,
        revalidate_instances="always",
    )
    name: str
    """
    Name of the data source type (e.g., SqlDataSource, LakeSource)
    """
    displayName: str | None = None
    """
    Human-readable display name
    """
    description: str | None = None
    """
    Description of the data source type
    """
    dataTypeMapping: Annotated[Sequence[SourceDataTypeMapping], Field(min_length=1)]
    """
    Default data type mappings for this source type
    """
    pluginId: str | None = None
    """
    ID of the plugin used to connect to the source type. If not provided falls back to builtin plugins matching the  name
    """
    connectionProperties: Annotated[Sequence[ConnectionProperty], Field(min_length=1)]
    """
    Required connection properties for this source type
    """
    authModes: Sequence[AuthMode]
    """
    Describes different authentication modes and which connection properties are relevant for it.
    """

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj: Any) -> DataSourceType:
        return DataSourceType.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> DataSourceType:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        DataSourceType
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = DataSourceType.model_validate_json(file.read())

        return model

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))


class SourceObject(BaseModel):
    schema_: Annotated[str | None, Field(alias="schema")] = None
    name: str
    type: str

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj: Any) -> SourceObject:
        return SourceObject.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> SourceObject:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        SourceObject
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = SourceObject.model_validate_json(file.read())

        return model

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))


class SourceField(BaseModel):
    name: str
    ordinal: Annotated[int, Field(ge=1)]
    dataType: str
    maxLength: Annotated[int | None, Field(ge=1)] = None
    numericPrecision: Annotated[int | None, Field(ge=1)] = None
    numbericScale: Annotated[int | None, Field(ge=1)] = None
    isNullable: bool
    isPrimaryKey: bool | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj: Any) -> SourceField:
        return SourceField.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> SourceField:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        SourceField
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = SourceField.model_validate_json(file.read())

        return model

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))


class DataSource(BaseModel):
    """
    Defines an external source of data to be loaded with datam8.
    """

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        validate_assignment=True,
        revalidate_instances="always",
    )
    name: str
    displayName: str | None = None
    description: str | None = None
    properties: Sequence[property.PropertyReference] | None = None
    type: str
    dataTypeMapping: Sequence[SourceDataTypeMapping] | None = None
    """
    Optional data type mappings. If not specified, uses defaults from DataSourceTypes. Individual mappings override defaults.
    """
    extendedProperties: Mapping[str, str | bool | int | float]
    """
    Additional properties specific to the data source
    """

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj: Any) -> DataSource:
        return DataSource.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> DataSource:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        DataSource
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = DataSource.model_validate_json(file.read())

        return model

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))

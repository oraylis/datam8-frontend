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

from collections.abc import Sequence
from pathlib import Path
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field


class PropertyReference(BaseModel):
    """
    Used to reference from any entity to a `Property`.
    """

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        validate_assignment=True,
        revalidate_instances="always",
    )
    property: str
    value: str

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj: Any) -> PropertyReference:
        return PropertyReference.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> PropertyReference:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        PropertyReference
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = PropertyReference.model_validate_json(file.read())

        return model

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))


class PropertyScope(BaseModel):
    """
    Defines for which type of entities a `PropertyType` is available for assignment.
    """

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        validate_assignment=True,
        revalidate_instances="always",
    )
    type: str
    singleUsage: bool | None = True
    """
    Defines if the `PropertyType` can only be assigned once to entities in this scope.
    """
    mandatory: bool | None = False

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj: Any) -> PropertyScope:
        return PropertyScope.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> PropertyScope:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        PropertyScope
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = PropertyScope.model_validate_json(file.read())

        return model

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))


class PropertyValue(BaseModel):
    """
    A single globally available static property value that can be referenced from other entities.
    """

    model_config = ConfigDict(
        extra="allow",
        populate_by_name=True,
        validate_assignment=True,
        revalidate_instances="always",
    )
    name: str
    displayName: str | None = None
    default: bool | None = False
    property: str
    """
    The name of the associated property.
    """
    properties: Sequence[PropertyReference] | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj: Any) -> PropertyValue:
        return PropertyValue.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> PropertyValue:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        PropertyValue
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = PropertyValue.model_validate_json(file.read())

        return model

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))


class Property(BaseModel):
    """
    Defines properties for which specific pre-selectable values can created.
    """

    model_config = ConfigDict(
        extra="allow",
        populate_by_name=True,
        validate_assignment=True,
        revalidate_instances="always",
    )
    name: str
    displayName: str
    schema_: Annotated[str | None, Field(alias="schema")] = None
    scopes: Sequence[PropertyScope] | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj: Any) -> Property:
        return Property.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> Property:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        Property
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = Property.model_validate_json(file.read())

        return model

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))

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


class Type(Enum):
    RAW = "raw"


class Parameter(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    name: str
    value: str
    custom: Mapping[str, Any] | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj) -> Parameter:
        return Parameter.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> Parameter:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        Parameter
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = Parameter.model_validate_json(file.read())

        return model


class Attribute(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    name: str
    type: str
    charLength: int | None = None
    charSet: str | None = None
    precision: int | None = None
    scale: int | None = None
    nullable: bool | None = None
    unitName: str | None = None
    unitType: str | None = None
    tags: Sequence[str] | None = None
    dateModified: str | None = None
    dateDeleted: str | None = None
    dateAdded: str | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj) -> Attribute:
        return Attribute.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> Attribute:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        Attribute
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = Attribute.model_validate_json(file.read())

        return model


class RawFunction(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    dataSource: str | None = None
    sourceLocation: str | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj) -> RawFunction:
        return RawFunction.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> RawFunction:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        RawFunction
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = RawFunction.model_validate_json(file.read())

        return model


class RawEntity(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    dataModule: str
    dataProduct: str
    name: str
    displayName: str
    purpose: str | None = None
    explanation: str | None = None
    parameters: Sequence[Parameter] | None = None
    tags: Sequence[str] | None = None
    attribute: Sequence[Attribute] | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj) -> RawEntity:
        return RawEntity.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> RawEntity:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        RawEntity
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = RawEntity.model_validate_json(file.read())

        return model


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    field_schema: Annotated[str | None, Field(alias="$schema")] = None
    type: Type
    entity: RawEntity | None = None
    function: RawFunction | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj) -> Model:
        return Model.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> Model:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        Model
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = Model.model_validate_json(file.read())

        return model

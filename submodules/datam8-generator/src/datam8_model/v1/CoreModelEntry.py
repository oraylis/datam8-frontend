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
    CORE = "core"


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


class History(Enum):
    SCD0 = "SCD0"
    SCD1 = "SCD1"
    SCD2 = "SCD2"
    BK = "BK"
    SK = "SK"
    SCD1_TIMESTAMP = "SCD1_TIMESTAMP"


class Attribute(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    name: str
    displayName: str | None = None
    purpose: str | None = None
    explanation: str | None = None
    attributeType: str | None = None
    dataType: str | None = None
    businessKeyNo: int | None = None
    alternateKeyGroup: str | None = None
    alternateKeyNo: int | None = None
    charLength: int | None = None
    charSet: str | None = None
    precision: int | None = None
    scale: int | None = None
    nullable: bool | None = None
    unitAttribute: str | None = None
    parameter: Sequence[Parameter] | None = None
    tags: Sequence[str] | None = None
    refactorNames: Sequence[str] | None = None
    history: History | None = History.SCD1

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


class RelationshipField(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    dm8lAttr: str
    dm8lKeyAttr: str

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj) -> RelationshipField:
        return RelationshipField.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> RelationshipField:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        RelationshipField
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = RelationshipField.model_validate_json(file.read())

        return model


class Relationship(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    dm8lKey: str
    role: str
    fields: Sequence[RelationshipField] | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj) -> Relationship:
        return Relationship.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> Relationship:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        Relationship
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = Relationship.model_validate_json(file.read())

        return model


class CoreEntity(BaseModel):
    dataModule: str
    dataProduct: str
    name: str
    extensionOf: str | None = None
    displayName: str
    purpose: str | None = None
    explanation: str | None = None
    parameters: Sequence[Parameter] | None = None
    tags: Sequence[str] | None = None
    attribute: Sequence[Attribute] | None = None
    relationship: Sequence[Relationship] | None = None
    refactorNames: Sequence[str] | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj) -> CoreEntity:
        return CoreEntity.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> CoreEntity:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        CoreEntity
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = CoreEntity.model_validate_json(file.read())

        return model


class MappingItem(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    name: str | None = None
    sourceComputation: str | None = None
    sourceName: str

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj) -> MappingItem:
        return MappingItem.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> MappingItem:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        MappingItem
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = MappingItem.model_validate_json(file.read())

        return model


class SourceEntity(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    dm8l: str
    filter: str | None = None
    mapping: Sequence[MappingItem] | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj) -> SourceEntity:
        return SourceEntity.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> SourceEntity:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        SourceEntity
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = SourceEntity.model_validate_json(file.read())

        return model


class CoreFunction(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    fileType: str | None = None
    storageType: str | None = None
    processingMethod: str | None = None
    deltaExpression: str | None = None
    filterStatement: str | None = None
    source: Sequence[SourceEntity] | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj) -> CoreFunction:
        return CoreFunction.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> CoreFunction:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        CoreFunction
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = CoreFunction.model_validate_json(file.read())

        return model


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    field_schema: Annotated[str | None, Field(alias="$schema")] = None
    type: Type
    entity: CoreEntity | None = None
    function: CoreFunction | None = None

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

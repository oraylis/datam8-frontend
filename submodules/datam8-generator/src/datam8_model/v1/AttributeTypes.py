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
from enum import Enum
from pathlib import Path
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class Type(Enum):
    ATTRIBUTE_TYPE = "attributeType"


class HasUnit(Enum):
    NO_UNIT = "NoUnit"
    PHYSICAL = "Physical"
    CURRENCY = "Currency"
    UNIT_FREE = "UnitFree"


class IsUnit(Enum):
    NO_UNIT = "NoUnit"
    PHYSICAL = "Physical"
    CURRENCY = "Currency"


class AttributeType(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)
    name: str
    displayName: str
    purpose: str | None = None
    explanation: str | None = None
    defaultType: str
    defaultLength: int | None = None
    defaultPrecision: int | None = None
    defaultScale: int | None = None
    hasUnit: HasUnit | None = None
    isUnit: IsUnit | None = None
    canBeInRelation: bool | None = False
    isDefaultProperty: bool | None = False

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj) -> AttributeType:
        return AttributeType.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> AttributeType:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        AttributeType
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = AttributeType.model_validate_json(file.read())

        return model


class Model(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)
    field_schema: Annotated[str | None, Field(alias="$schema")] = None
    type: Type | None = None
    items: Sequence[AttributeType] | None = None

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

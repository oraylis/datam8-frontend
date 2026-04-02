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
from typing import Annotated, Any

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from . import data_type, property


class HistoryType(Enum):
    """
    Defines how an attribute in a slowly changing dimension should behave.
    """

    SCD0 = "SCD0"
    SCD1 = "SCD1"
    SCD2 = "SCD2"
    SCD3 = "SCD3"
    SCD4 = "SCD4"


class ExpressionLanguage(Enum):
    SQL = "sql"
    DAX = "dax"
    PYTHON = "python"


class HasUnit(Enum):
    """
    Defines if an attribute should define a unit, e.g. `Physical` for weight or `Currency` for price.
    """

    NO_UNIT = "NoUnit"
    PHYSICAL = "Physical"
    CURRENCY = "Currency"


class AttributeType(BaseModel):
    """
    Defines abstract business orientated attribute definitions, e.g. an email address
    """

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        validate_assignment=True,
        revalidate_instances="always",
    )
    name: str
    displayName: str
    description: str | None = None
    defaultType: str
    defaultLength: Annotated[int | None, Field(gt=0)] = None
    defaultPrecision: Annotated[int | None, Field(gt=0)] = None
    defaultScale: Annotated[int | None, Field(gt=0)] = None
    hasUnit: HasUnit | None = HasUnit.NO_UNIT
    """
    Defines if an attribute should define a unit, e.g. `Physical` for weight or `Currency` for price.
    """
    canBeInRelation: bool | None = False
    isDefaultProperty: bool | None = False

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj: Any) -> AttributeType:
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

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))


class Attribute(BaseModel):
    """
    An attribute of a model entity.
    """

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        validate_assignment=True,
        revalidate_instances="always",
    )
    ordinalNumber: Annotated[int, Field(gt=0)]
    name: str
    displayName: str | None = None
    description: str | None = None
    attributeType: str
    dataType: data_type.DataType
    isBusinessKey: bool | None = False
    history: Annotated[HistoryType | None, Field(title="HistoryType")] = HistoryType.SCD1
    """
    Defines how an attribute in a slowly changing dimension should behave.
    """
    expression: str | None = None
    expressionLanguage: ExpressionLanguage | str | None = ExpressionLanguage.SQL
    unit: str | None = None
    refactorNames: Sequence[str] | None = None
    dateModified: AwareDatetime | None = None
    dateDeleted: AwareDatetime | None = None
    dateAdded: AwareDatetime
    properties: Sequence[property.PropertyReference] | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj: Any) -> Attribute:
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

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))

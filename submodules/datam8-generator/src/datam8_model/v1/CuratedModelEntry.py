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

from . import CoreModelEntry


class Type(Enum):
    CURATED = "curated"


class ComputationSourceEntity(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    dm8l: str

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj) -> ComputationSourceEntity:
        return ComputationSourceEntity.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> ComputationSourceEntity:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        ComputationSourceEntity
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = ComputationSourceEntity.model_validate_json(file.read())

        return model


class MergeType(Enum):
    """
    Merge type
      - self=responsibility of function;
      - partition=replace changed partition completely;
      - merge=merge on primary key;
      - replace=full replacement
    """

    SELF = "self"
    PARTITION = "partition"
    MERGE = "merge"
    REPLACE = "replace"


class Frequency(Enum):
    """
    Frequency of execution (not a schedule).
     The function is only executed once day/week/mounth/year
    """

    NO_RESTRICTION = "no_restriction"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"


class CuratedFunction(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    name: str
    """
    name of function
    """
    merge_type: MergeType
    """
    Merge type
      - self=responsibility of function;
      - partition=replace changed partition completely;
      - merge=merge on primary key;
      - replace=full replacement
    """
    frequency: Frequency
    """
    Frequency of execution (not a schedule).
     The function is only executed once day/week/mounth/year
    """
    frequency_reference: str | None = None
    """
    Depending on the value of the frequency for
      -no_restriction->nothing;
      - daily=time; weekly=weekday(+time);
      - monthly=day of month(+time);
      - yearly=day+month(+time)
    """
    source: Sequence[ComputationSourceEntity] | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj) -> CuratedFunction:
        return CuratedFunction.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> CuratedFunction:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        CuratedFunction
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = CuratedFunction.model_validate_json(file.read())

        return model


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    field_schema: Annotated[str | None, Field(alias="$schema")] = None
    type: Type
    entity: CoreModelEntry.CoreEntity | None = None
    function: Sequence[CuratedFunction] | None = None

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

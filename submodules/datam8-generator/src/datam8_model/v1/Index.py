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

from pydantic import BaseModel, ConfigDict


class IndexEntry(BaseModel):
    locator: str
    name: str
    absPath: str
    references: Sequence[str] | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj) -> IndexEntry:
        return IndexEntry.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> IndexEntry:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        IndexEntry
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = IndexEntry.model_validate_json(file.read())

        return model


class RawIndex(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    entry: Sequence[IndexEntry] | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj) -> RawIndex:
        return RawIndex.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> RawIndex:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        RawIndex
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = RawIndex.model_validate_json(file.read())

        return model


class StageIndex(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    entry: Sequence[IndexEntry] | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj) -> StageIndex:
        return StageIndex.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> StageIndex:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        StageIndex
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = StageIndex.model_validate_json(file.read())

        return model


class CoreIndex(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    entry: Sequence[IndexEntry] | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj) -> CoreIndex:
        return CoreIndex.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> CoreIndex:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        CoreIndex
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = CoreIndex.model_validate_json(file.read())

        return model


class CuratedIndex(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    entry: Sequence[IndexEntry] | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj) -> CuratedIndex:
        return CuratedIndex.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> CuratedIndex:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        CuratedIndex
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = CuratedIndex.model_validate_json(file.read())

        return model


class Model(BaseModel):
    rawIndex: RawIndex | None = None
    stageIndex: StageIndex | None = None
    coreIndex: CoreIndex | None = None
    curatedIndex: CuratedIndex | None = None

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

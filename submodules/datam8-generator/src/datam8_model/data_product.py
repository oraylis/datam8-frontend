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

from . import property


class DataModule(BaseModel):
    """
    Defines ...
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

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj: Any) -> DataModule:
        return DataModule.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> DataModule:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        DataModule
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = DataModule.model_validate_json(file.read())

        return model

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))


class DataProduct(BaseModel):
    """
    Defines ...
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
    dataModules: Annotated[Sequence[DataModule], Field(min_length=1)]

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj: Any) -> DataProduct:
        return DataProduct.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> DataProduct:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        DataProduct
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = DataProduct.model_validate_json(file.read())

        return model

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))

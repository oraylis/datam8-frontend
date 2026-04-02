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


class GeneratorTarget(BaseModel):
    """
    Defines a target that can be selected when using the generator.
    """

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        validate_assignment=True,
        revalidate_instances="always",
    )
    name: str
    isDefault: bool | None = False
    sourcePath: Path
    """
    A path relative to the folder where the the solution file lies.
    """
    outputPath: Path
    """
    A path relative to the folder where the the solution file lies.
    """

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj: Any) -> GeneratorTarget:
        return GeneratorTarget.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> GeneratorTarget:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        GeneratorTarget
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = GeneratorTarget.model_validate_json(file.read())

        return model

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))


class Solution(BaseModel):
    """
    A definition to hold various settings for use in the frontend or the generator.
    """

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        validate_assignment=True,
        revalidate_instances="always",
    )
    schemaVersion: str
    """
    Version of the schema for validation and migration support.
    """
    modelPath: Path
    """
    Root path for model entities, replacing zone-specific paths.
    """
    basePath: Path
    """
    Path where base entity files like DataSources are stored.
    """
    diagramPath: Path | None = None
    """
    tbd
    """
    pluginsPath: Path
    """
    Path where connector plugins are stored.
    """
    generatorTargets: Annotated[Sequence[GeneratorTarget], Field(min_length=1)]
    """
    Targets available to the generator when not explicitly specifying it.
    """

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj: Any) -> Solution:
        return Solution.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> Solution:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        Solution
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = Solution.model_validate_json(file.read())

        return model

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))

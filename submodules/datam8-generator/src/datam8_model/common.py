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

from pathlib import Path
from typing import Annotated, Any, TypeAlias

from pydantic import Field, RootModel

# ruff: disable[UP040]
# HACK: pydantic is not able to probably validate a PEP 695 type alias declaration, only seems to work with
# the legacy TypeAlias from typing
CommonType: TypeAlias = Any
"""
An attribute of a model entity.
"""
# ruff: enable[UP040]


class Common(RootModel[Any]):
    root: Annotated[Any, Field(title="Common")]
    """
    An attribute of a model entity.
    """

    @staticmethod
    def from_json_file(path: Path) -> Common:
        with open(path) as file:
            model = Common.model_validate_json(file.read())

        return model

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))

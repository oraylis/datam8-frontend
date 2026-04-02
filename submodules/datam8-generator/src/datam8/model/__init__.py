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

# ruff: noqa: F401

from __future__ import annotations

from pathlib import Path

from datam8_model import base as b

from .entity_wrapper import EntityWrapper, EntityWrapperVariant, PropertyReference
from .locator import ROOT_LOCATOR, Locator
from .model import MODEL_DUMP_OPTIONS, EntityDict, Model


def wrap_base_entity[T: b.BaseEntityType](
    entity_type: b.EntityType, locator_path: Path, entity: T, source_file: Path
) -> EntityWrapper[T]:
    """
    Wraps an entity parsed from a json file into an EntityWrapper object.

    Parameters
    ----------
    entity_type : `EntityType`
        The entity type parsed from the json file.
    path : `Path`
        Source file where the entity was read from.
    entity : `T`, generic
        The entity to wrap.

    Returns
    -------
    `EntityWrapper[T]`
        The entity embedded into an EntityWrapper base on the generic type.
    """

    locator = Locator(
        entityType=entity_type.value,
        folders=locator_path.as_posix().split("/")[1:-1],
        entityName=getattr(entity, "name"),  # noqa: B009
    )

    new_wrapper = EntityWrapper[T](
        locator=locator,
        entity=entity,
        source_file=source_file,
    )

    return new_wrapper


def new_empty_entity_type_dict() -> dict[b.EntityType, list[EntityWrapper[b.BaseEntityType]]]:
    """Create an empty dictionary to every available BaseEntityType.

    WARNING: The type of the result list items is not set.

    Returns
    -------
    list[Any]
        A dictionary with a key for every available entity type, mapping to an
        empty list.
    """
    return {_type: [] for _type in b.EntityType}

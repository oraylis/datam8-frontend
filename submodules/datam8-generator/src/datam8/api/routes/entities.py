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
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

from datam8 import factory, model
from datam8_model import base as b

from .responses import MultiItemResponse, SingleItemResponse

entities_router = APIRouter(prefix="/entities", tags=["entities"])


@entities_router.get("/{locator:path}")
async def get_entities(locator: str = "/") -> MultiItemResponse[model.EntityWrapperVariant]:
    """
    Returns a list of entities based on the given locator. Returns an empty list if none are found.
    """
    entities = factory.get_model().get_entities(locator)
    return MultiItemResponse.from_list(entities)


@entities_router.patch("/{locator:path}")
async def patch_entity(
    locator: str, patch: dict[str, Any]
) -> SingleItemResponse[model.EntityWrapperVariant]:
    wrapper = factory.get_model().get_entity_by_locator(locator)
    wrapper.update(**patch)
    return SingleItemResponse(item=wrapper)


@entities_router.delete("/{locator:path}")
async def delete_entity(locator: str) -> MultiItemResponse[model.Locator]:
    deleted_locators = factory.get_model().delete_entities(locator)
    return MultiItemResponse.from_list(deleted_locators)


@entities_router.put("/{locator:path}")
async def create_entity(
    locator: str, body: dict[str, Any]
) -> SingleItemResponse[model.EntityWrapper[b.BaseEntityType]]:
    entity = factory.get_model().add_entity(locator, body)
    return SingleItemResponse(item=entity)


class CloneEntityBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    locator: str
    new_locator: Annotated[str, Field(alias="newLocator")]


@entities_router.put("/clone")
async def clone_entity(
    body: CloneEntityBody,
) -> MultiItemResponse[model.EntityWrapper[b.BaseEntityType]]:
    entity = factory.get_model().clone_entity(body.locator, body.new_locator)
    return MultiItemResponse.from_list([entity])


class MoveBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    from_: Annotated[str, Field(alias="from")]
    to: Annotated[str, Field(alias="to")]

def _get_function_root(locator: model.Locator | str) -> Path:
    loc = model.Locator.from_path(locator) if isinstance(locator, str) else locator

    if loc.entityType != b.EntityType.MODEL_ENTITIES.value or not loc.entityName:
        raise ValueError("Function root is only available for model entity locators.")

    base_path = factory.get_model().get_base_path_for_entity_type(b.EntityType.MODEL_ENTITIES)
    return Path(base_path, *loc.folders, loc.entityName)


def _move_function_directory_if_present(from_locator: str, to_locator: str) -> None:
    from_loc = model.Locator.from_path(from_locator)
    to_loc = model.Locator.from_path(to_locator)

    if (
        from_loc.entityType != b.EntityType.MODEL_ENTITIES.value
        or to_loc.entityType != b.EntityType.MODEL_ENTITIES.value
        or not from_loc.entityName
    ):
        return

    target_name = to_loc.entityName or from_loc.entityName

    from_dir = _get_function_root(from_loc)
    to_dir = Path(
        factory.get_model().get_base_path_for_entity_type(b.EntityType.MODEL_ENTITIES),
        *to_loc.folders,
        target_name,
    )

    if from_dir == to_dir or not from_dir.exists():
        return

    to_dir.parent.mkdir(parents=True, exist_ok=True)

    if to_dir.exists():
        raise FileExistsError(f"Target function directory already exists: {to_dir}")

    from_dir.rename(to_dir)

@entities_router.post("/move")
async def move_entities(body: MoveBody) -> MultiItemResponse[model.EntityWrapperVariant]:
    entities = factory.get_model().move_entities(body.from_, body.to)

    _move_function_directory_if_present(body.from_, body.to)

    return MultiItemResponse.from_list(entities)

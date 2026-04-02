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

from fastapi import APIRouter
from pydantic import BaseModel

from datam8 import factory, model
from datam8_model import base as b
from datam8_model import solution as s

solution_router = APIRouter(prefix="/solution")


@solution_router.get("")
async def get_solution() -> s.Solution:
    return factory.get_model().solution


class DumpSolutionResponse(BaseModel):
    solution: s.Solution
    base_entities: list[model.EntityWrapperVariant]
    model_entities: list[model.EntityWrapperVariant]
    folder_entities: list[model.EntityWrapperVariant]


@solution_router.get("/full")
async def get_full_solution() -> DumpSolutionResponse:
    model = factory.get_model()
    base_entities, model_entities, folder_entities = [], [], []

    for wrapper in model.get_entity_iterator():
        match wrapper.locator.entityType:
            case b.EntityType.FOLDERS.value:
                folder_entities.append(wrapper)
            case b.EntityType.MODEL_ENTITIES.value:
                model_entities.append(wrapper)
            case _:
                base_entities.append(wrapper)

    response = DumpSolutionResponse(
        solution=model.solution,
        base_entities=base_entities,
        model_entities=model_entities,
        folder_entities=folder_entities,
    )
    return response

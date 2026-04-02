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
from typing import Annotated

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

from datam8 import config, factory

from .entities import entities_router
from .model import model_router
from .plugins import plugins_router
from .secrets import secrets_router
from .solution import solution_router
from .sources import sources_router

router = APIRouter()


class HealthResponse(BaseModel):
    status: str = "ok"


@router.get("/health")
async def get_health() -> HealthResponse:
    """Return service health status."""
    return HealthResponse()


class VersionResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    schema_version: Annotated[str, Field(alias="schemaVersion")]
    app_version: Annotated[str, Field(alias="appVersion")]


@router.get("/version")
async def get_version() -> VersionResponse:
    """Return backend version."""
    response = VersionResponse(
        schema_version=factory.get_model().solution.schemaVersion,
        app_version=config.get_version(),
    )
    return response


class ConfigResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str
    solution_file_path: Annotated[Path, Field(alias="solutionFilePath")]
    lazy: bool
    supported_model_versions: Annotated[list[str], Field(alias="supportedModelVersions")]
    log_level: Annotated[str, Field(alias="logLevel")]


@router.get("/config")
async def get_config() -> ConfigResponse:
    response = ConfigResponse(
        name=config.get_name(),
        solution_file_path=config.solution_path,
        lazy=config.lazy,
        supported_model_versions=config.supported_model_versions,
        log_level=config.log_level.value,
    )
    return response


router.include_router(solution_router)
router.include_router(model_router)
router.include_router(entities_router)
router.include_router(sources_router)
router.include_router(plugins_router)
router.include_router(secrets_router)

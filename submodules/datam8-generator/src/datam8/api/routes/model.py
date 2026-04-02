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

from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from datam8 import config, factory, generate, model, opts
from datam8_model import base as b

model_router = APIRouter(prefix="/model", tags=["model"])


class GenerateBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    target: str | None = None
    clean_output: Annotated[bool | None, Field(alias="cleanOutput")] = None
    payloads: list[str] | None = None


class GenerateResponse(BaseModel):
    target: str | None
    output_path: Annotated[str | None, Field(alias="outputPath")] = None
    message: str | None = None


@model_router.post("/generate")
async def generator_run(body: GenerateBody | None = None) -> GenerateResponse:
    """Execute generator synchronously."""

    # The API server is long-lived; decorators in target modules would otherwise
    # re-register payloads on subsequent runs and fail with "already registered".
    generate.payload_functions.clear()

    target = body.target if body is not None else None
    payloads = body.payloads if body is not None else None
    clean_output = body.clean_output if body is not None else None

    output_path = generate.generate_output(
        factory.get_model(),
        target=target or opts.default_target,
        payloads=payloads or [],
        clean_output=clean_output or False,
        generate_all=False,
    )

    response = GenerateResponse(
        target=target or opts.default_target,
        output_path=output_path.as_posix(),
    )

    return response


class SaveBody(BaseModel):
    locator: str | None = None


@model_router.post("/save")
async def model_save(body: SaveBody | None = None) -> None:
    factory.get_model().save(body.locator if body is not None else None)


class RealoadResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    reloaded_at: Annotated[datetime, Field(alias="reloadedAt")]


@model_router.post("/reload")
async def model_reload(force: bool = False) -> RealoadResponse:
    pending_changes, pending_deletions = factory.get_model().get_unsaved_entities()
    if (len(pending_changes) > 0 or len(pending_deletions) > 0) and not force:
        pending = len(pending_changes) + len(pending_deletions)
        raise HTTPException(
            status_code=409, detail=f"Pending changes ({pending}) - save model or use force"
        )

    factory._model = await factory.load_model(config.solution_path)
    response = RealoadResponse(reloaded_at=datetime.now(UTC))

    return response


class UnsavedResponse(BaseModel):
    count: int
    changed: list[model.Locator]
    deleted: list[model.Locator]

class FunctionSourceBody(BaseModel):
    locator: str
    source: str
    content: str | None = None


class FunctionRenameBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    locator: str
    from_source: Annotated[str, Field(alias="fromSource")]
    to_source: Annotated[str, Field(alias="toSource")]


class FunctionSourceResponse(BaseModel):
    content: str


class FunctionMutationResponse(BaseModel):
    ok: bool = True


def _normalize_source_path(source: str) -> str:
    normalized = (source or "").strip().replace("\\", "/")

    if not normalized:
        raise HTTPException(status_code=400, detail="Source path must not be empty.")

    if normalized.startswith("/") or any(part in {".", ".."} for part in normalized.split("/")):
        raise HTTPException(status_code=400, detail="Invalid source path.")

    return normalized


def _get_function_root(locator: str) -> Path:
    loc = model.Locator.from_path(locator)

    if loc.entityType != b.EntityType.MODEL_ENTITIES.value or not loc.entityName:
        raise HTTPException(status_code=400, detail="Locator must point to a model entity.")

    base_path = factory.get_model().get_base_path_for_entity_type(b.EntityType.MODEL_ENTITIES)
    return Path(base_path, *loc.folders, loc.entityName)


def _get_function_source_path(locator: str, source: str) -> Path:
    return _get_function_root(locator) / _normalize_source_path(source)


def _prune_empty_dirs_until_entity_root(file_path: Path, entity_root: Path) -> None:
    current = file_path.parent

    while current.exists() and current != entity_root.parent:
        try:
            current.rmdir()
        except OSError:
            break
        current = current.parent

@model_router.get("/unsaved")
async def get_unsaved() -> UnsavedResponse:
    changed, deleted = factory.get_model().get_unsaved_entities()
    response = UnsavedResponse(
        count=len(changed) + len(deleted),
        changed=changed,
        deleted=deleted,
    )
    return response

@model_router.get("/function/source")
async def get_function_source(
    locator: str = Query(...),
    source: str = Query(...),
) -> FunctionSourceResponse:
    path = _get_function_source_path(locator, source)

    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Function source not found.")

    return FunctionSourceResponse(content=path.read_text(encoding="utf-8"))


@model_router.post("/function/source")
async def save_function_source(body: FunctionSourceBody) -> FunctionMutationResponse:
    path = _get_function_source_path(body.locator, body.source)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body.content or "", encoding="utf-8")
    return FunctionMutationResponse()


@model_router.delete("/function/source")
async def delete_function_source(
    locator: str = Query(...),
    source: str = Query(...),
) -> FunctionMutationResponse:
    path = _get_function_source_path(locator, source)

    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Function source not found.")

    path.unlink()

    entity_root = _get_function_root(locator)
    _prune_empty_dirs_until_entity_root(path, entity_root)

    return FunctionMutationResponse()


@model_router.post("/function/rename")
async def rename_function_source(body: FunctionRenameBody) -> FunctionMutationResponse:
    from_path = _get_function_source_path(body.locator, body.from_source)
    to_path = _get_function_source_path(body.locator, body.to_source)

    if not from_path.exists() or not from_path.is_file():
        raise HTTPException(status_code=404, detail="Function source not found.")

    to_path.parent.mkdir(parents=True, exist_ok=True)

    if to_path.exists() and to_path != from_path:
        raise HTTPException(status_code=409, detail="Target function source already exists.")

    from_path.rename(to_path)
    return FunctionMutationResponse()

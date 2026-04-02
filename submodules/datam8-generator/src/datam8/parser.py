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

"""
This module handles all parsing of json files into generator internal objects.
"""

from __future__ import annotations

import pathlib
from concurrent import futures
from typing import Any

from pydantic import ValidationError

from datam8 import config, errors, logging
from datam8.model import (
    EntityDict,
    EntityWrapper,
    Locator,
    Model,
    new_empty_entity_type_dict,
    wrap_base_entity,
)
from datam8_model import base as b
from datam8_model import model as m
from datam8_model import solution as s

logger = logging.getLogger(__name__)


# @utils.print_progress_async("Parsing files...")
async def parse_full_solution_async(solution_path: pathlib.Path, /) -> Model:
    """Load and parses all json files in a solution into generator internal objects.

    Executes loading & parsing of json files via multi threading.

    Parameters
    ----------
    solution_path : `Path`
        path to the solution file (.dm8s)
    lazy : `bool`
        if lazy loading is enabled model entities will not be loaded, which
        needs to be handeled afterwards on the fly.

    Returns
    -------
    Model
        The parsed model from files BUT not validated in regards to internal
        references, e.g. PropertyReferences.
    """
    logger.debug("Start parsing solution")

    executor = futures.ThreadPoolExecutor()

    solution = parse_solution_file(solution_path)
    worker_model = executor.submit(__parse_model_entities, solution.modelPath)
    worker_base = executor.submit(__parse_base_entities, solution.basePath, solution.modelPath)

    base_entities = worker_base.result()
    model_entities = worker_model.result()

    model = Model(
        solution,
        modelEntities=model_entities,
        **base_entities,
    )

    executor.shutdown()

    logger.info("Parsed all files in solution")

    return model


def __parse_base_entity_type(entity_type: str, /) -> b.EntityType:
    return {e.value: e for e in b.EntityType}[entity_type]


def parse_solution_file(path: pathlib.Path, /) -> s.Solution:
    solution = s.Solution.from_json_file(path)

    if solution.schemaVersion not in config.supported_model_versions:
        raise errors.NotSupportedModelVersionError(solution.schemaVersion)

    logger.info(
        f"Parsed solution file with schema version: {solution.schemaVersion}",
    )
    logger.debug(solution.model_dump_json(indent=4))
    return solution


def __parse_model_entities(
    path: pathlib.Path,
    *,
    executor: futures.ThreadPoolExecutor | None = None,
) -> EntityDict[m.ModelEntity]:
    model_entities: EntityDict[m.ModelEntity] = {}
    parse_errors: dict[pathlib.Path, ValidationError] = {}

    logger.debug(f"Scanning {path} for model entities")

    model_files = [
        file
        for file in (config.solution_folder_path / path).glob("**/*.json")
        if not file.match(".properties.json")
    ]

    if not model_files:
        logger.warning("Not model entity files found")

    if executor is None:
        _executor = futures.ThreadPoolExecutor()
    else:
        _executor = executor

    loaded_entities = _executor.map(__parse_model_entity_file, model_files)

    for rel_path, model_entity_or_err in loaded_entities:
        if isinstance(model_entity_or_err, ValidationError):
            parse_errors[rel_path] = model_entity_or_err
            continue

        clean_path = rel_path.as_posix().removeprefix(path.as_posix())
        locator = Locator.from_path(f"{b.EntityType.MODEL_ENTITIES.value}{clean_path}")
        model_entities[locator] = EntityWrapper[m.ModelEntity](
            source_file=config.solution_folder_path / rel_path,
            locator=locator,
            entity=model_entity_or_err,
        )

    if executor is None:
        _executor.shutdown()

    if parse_errors:
        raise errors.ModelParseError(inner_exceptions=[err for err in parse_errors.values()])

    logger.info(f"Parsed model entities: {len(model_files)}")

    return model_entities


def __parse_model_entity_file(
    path: pathlib.Path, /
) -> tuple[pathlib.Path, m.ModelEntity | ValidationError]:
    rel_path = path.relative_to(config.solution_folder_path)

    try:
        model_entity = m.ModelEntity.from_json_file(path)
    except ValidationError as err:
        logger.error(f"{path}: \n{err}")
        return rel_path, err

    logger.debug(rel_path)

    return rel_path, model_entity


def __parse_base_entities(
    base_path: pathlib.Path,
    /,
    model_path: pathlib.Path,
    *,
    executor: futures.ThreadPoolExecutor | None = None,
) -> dict[str, EntityDict[Any]]:
    logger.debug(f"Scanning {base_path} for base entities")
    logger.debug(f"Scanning {model_path} for folder entities")

    base_files = [
        *(config.solution_folder_path / base_path).glob("**/*.json"),
        *(config.solution_folder_path / model_path).glob("**/.properties.json"),
    ]

    _executor = executor or futures.ThreadPoolExecutor()

    # ensure every entity type except modelEntities is present in dictionary
    base_entities: dict[b.EntityType, list[EntityWrapper[b.BaseEntityType]]] = (
        new_empty_entity_type_dict()
    )
    del base_entities[b.EntityType.MODEL_ENTITIES]

    loaded_entities = _executor.map(__parse_base_entity_file, base_files)
    parse_errors: dict[pathlib.Path, ValidationError] = {}

    for rel_path, base_entity_list_or_err in loaded_entities:
        if isinstance(base_entity_list_or_err, ValidationError):
            parse_errors[rel_path] = base_entity_list_or_err
            continue

        entity_type, entity_list = base_entity_list_or_err

        for entity in entity_list:
            locator_path = pathlib.Path(entity.name)

            # NOTE: some types need special handling due them being embedded/
            # referenced in other entities
            match entity_type:
                case b.EntityType.PROPERTY_VALUES:
                    locator_path = (
                        pathlib.Path(entity_type.value, getattr(entity, "property"), locator_path)  # noqa: B009
                    )
                case b.EntityType.FOLDERS:
                    locator_path = rel_path.parents[1] / locator_path

            base_entities[entity_type].append(
                wrap_base_entity(
                    entity_type=entity_type,
                    locator_path=locator_path,
                    entity=entity,
                    source_file=config.solution_folder_path / rel_path,
                )
            )

    if executor is None:
        _executor.shutdown()

    if parse_errors:
        raise errors.ModelParseError(inner_exceptions=[err for err in parse_errors.values()])

    unpacked_entities = {
        k.value: {wrapped_entity.locator: wrapped_entity for wrapped_entity in v}
        for k, v in base_entities.items()
    }

    __validate_folder_product_module(unpacked_entities)

    for _t, _entity in unpacked_entities.items():
        logger.info(f"Parsed {_t} entities: {len(_entity)}")

    return unpacked_entities


def __parse_base_entity_file(
    path: pathlib.Path, /
) -> tuple[pathlib.Path, tuple[b.EntityType, list[b.BaseEntityType]] | ValidationError]:
    rel_path = path.relative_to(config.solution_folder_path)

    try:
        base_entities = b.BaseEntities.from_json_file(path)
    except ValidationError as err:
        logger.error(f"{path}: \n{err}")
        return rel_path, err

    entities_type = __parse_base_entity_type(base_entities.root.type)
    entities = getattr(base_entities.root, entities_type.value)

    logger.debug(rel_path)

    return rel_path, (entities_type, entities)


def __validate_folder_product_module(base_entities: dict[str, EntityDict[Any]], /) -> None:
    data_products: EntityDict[Any] = base_entities.get(b.EntityType.DATA_PRODUCTS.value, {})
    folders: EntityDict[Any] = base_entities.get(b.EntityType.FOLDERS.value, {})

    known_products: dict[str, set[str]] = {}
    for wrapped in data_products.values():
        product_name = (getattr(wrapped.entity, "name", "") or "").strip()
        if not product_name:
            continue
        module_names: set[str] = set()
        for module in getattr(wrapped.entity, "dataModules", []) or []:
            module_name = (getattr(module, "name", "") or "").strip()
            if module_name:
                module_names.add(module_name)
        known_products[product_name] = module_names

    issues: list[str] = []
    for wrapped in folders.values():
        locator = str(wrapped.locator)
        data_product = (getattr(wrapped.entity, "dataProduct", "") or "").strip()
        data_module = (getattr(wrapped.entity, "dataModule", "") or "").strip()

        if data_module and not data_product:
            issues.append(f"{locator}: dataModule '{data_module}' requires dataProduct.")
            continue

        if data_product and data_product not in known_products:
            issues.append(
                f"{locator}: dataProduct '{data_product}' does not exist in Base/DataProducts.json."
            )
            continue

        if data_module and data_product:
            available_modules = known_products.get(data_product, set())
            if data_module not in available_modules:
                issues.append(
                    f"{locator}: dataModule '{data_module}' does not exist under dataProduct '{data_product}'."
                )

    if issues:
        raise errors.ModelParseError(
            msg="Folder metadata validation failed.",
            inner_exceptions=[ValueError(issue) for issue in issues],
        )

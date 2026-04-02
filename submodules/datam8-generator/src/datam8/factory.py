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

import asyncio
import pathlib

from pydantic_core import ValidationError

from datam8 import config, logging, model, parser, plugins, utils
from datam8.errors import (
    EntityNotFoundError,
    ModelParseError,
    NotSupportedModelVersionError,
    PropertiesNotResolvedError,
)
from datam8_model import data_source as ds
from datam8_model import folder as f
from datam8_model import solution as s
from datam8_model.property import PropertyReference, PropertyValue

logger = logging.getLogger(__name__)

_model: model.Model | None = None
_plugin_manager: plugins.PluginManager | None = None


def get_plugin_manager(
    solution: s.Solution | None = None, /, *, reset: bool = False
) -> plugins.PluginManager:
    """
    Get a plugin manager for the currently loaded solution.

    Parameter
    ---------
    solution : :class:`Solution`, optional
        If not provided the currently loaded / configured Solution will be used
    reset : `bool`, optional
        If set a new PluginManager will be created. Defaults to `False`.

    Returns
    -------
    A :class:`PluginManager` object, that if newly created has all available Plugins already registered
    """
    global _plugin_manager

    if _plugin_manager is None or reset:
        _plugin_manager = plugins.PluginManager(solution or get_model().solution)

    return _plugin_manager


def get_plugin_for_data_source(data_source: ds.DataSource | str) -> plugins.Plugin:
    _model = get_model()

    if isinstance(data_source, str):
        data_source_ = get_model().get_data_source(data_source).entity
    else:
        data_source_ = data_source

    type_ = _model.get_data_source_type(data_source_.type).entity

    # register builtin plugin if applicable
    plugins.init_builtin_plugins(data_source_type=type_, plugin_id=type_.pluginId)

    plugin = get_plugin_manager(_model.solution).get_plugin_instantiator(type_)(data_source_, type_)
    logger.debug(f"Lookup {plugin} for {type_}")
    return plugin


def get_model() -> model.Model:
    """
    Get the currently loaded model. In case no model was loaded yet, it will create it
    based on the current configuration.
    """
    global _model

    if _model is None:
        _model = create_model()

    return _model


def create_model(solution_path: pathlib.Path | None = None, /) -> model.Model:
    """
    Create model from a provided solution path. If no path is provided it will fall back to the
    global configuration.

    Parameters
    ----------
    solution_path : pathlib.Path | None
        solution_path parameter value.

    Returns
    -------
    model.Model
        Computed return value.
    """
    global _model

    path = solution_path or config.solution_path
    if not path.exists():
        raise FileNotFoundError(path)

    _model = asyncio.run(load_model(path))

    return _model


async def load_model(solution_path: pathlib.Path, /) -> model.Model:
    _model = await parser.parse_full_solution_async(solution_path)
    create_undefined_folders(_model)
    _model.init_file_references()

    if not config.lazy:
        _model.resolve()

    return _model


def create_model_or_exit(solution_path: pathlib.Path | None = None, /) -> model.Model:
    """
    Create model and exit the program in case of a known error. This function is mainly provided
    to be used in the context of a CLI.

    Parameters
    ----------
    solution_path : pathlib.Path | None
        solution_path parameter value.

    Returns
    -------
    model.Model
        Computed return value.
    """

    try:
        return create_model(solution_path)
    except NotSupportedModelVersionError as err:
        logger.error(err)
        raise utils.create_error(
            f"Supported versions are: {config.supported_model_versions}", exit_code=2
        )
    except FileNotFoundError as err:
        raise utils.create_error(f"Solution file does not exist: {err}")
    except RecursionError as err:
        raise utils.create_error(str(err))
    except Exception as err:
        match err:
            case (
                ValidationError()
                | ModelParseError()
                | EntityNotFoundError()
                | PropertiesNotResolvedError() as err_
            ):
                raise utils.create_error(str(err_), exit_code=3)
            case _:
                raise utils.create_error(err)


def resolve_property(model: model.Model, /, reference: PropertyReference) -> list[PropertyValue]:
    """
    Lookup and Resolve a single PropertyReference. Useful to resolve properties that are not
    set directly on the entity, e.g. a property on an attribute.

    Parameters
    ----------
    model : `Model`
        The DataM8 Model that will be used to lookup the PropertyReference
    reference : `PropertyReference`
        The PropertyReference, i.e. property-value-pair, that will be recursively resolved
        with the provided model.

    Returns
    -------
    list[PropertyValue]
        A list of all properties that are related to the provided reference. The PropertyValue
        includes all custom attributes.
    """
    properties: list[PropertyValue] = []

    for pv in model.propertyValues.values():
        if (pv.entity.property, pv.entity.name) != (reference.property, reference.value):
            continue

        properties.append(pv.entity)

        for nested_ref in pv.entity.properties or []:
            properties.extend(resolve_property(model, nested_ref))

        # early exit of loop if match was found
        break

    return properties


def create_undefined_folders(_model: model.Model, /):
    """
    Goes through all model entities and adds folder wrappers for every parent locator
    of an entity that does not exist yet.

    Folder IDs are simply sequential increased during runtime.

    Parameters
    ----------
    _model : `model.Model`
        A fully parsed DataM8 folder. Can be run pre or post property resolution.
    """
    existing_folders = [w.entity.id for w in _model.folders.values()]
    next_id = (max(existing_folders) if len(existing_folders) != 0 else 0) + 1

    undefined_folders: model.EntityDict[f.Folder] = {}

    for wrapper in _model.get_entity_iterator():
        loc = wrapper.locator
        for ploc in loc.parents:
            if ploc in _model.folders or ploc.entityName is None:
                continue

            source_file_path = pathlib.Path(
                config.solution_folder_path,
                _model.solution.modelPath,
                *ploc.folders,
                ploc.entityName,
                ".properties.json",
            )

            # file will not be created, only when a change is applied/saved
            undefined_folders[ploc] = model.EntityWrapper(
                source_file=source_file_path.absolute(),
                locator=ploc,
                entity=f.Folder(
                    id=next_id,
                    name=ploc.entityName,
                ),
            )

            next_id += 1

    for loc in undefined_folders:
        if loc not in _model.folders:
            _model.folders[loc] = undefined_folders[loc]

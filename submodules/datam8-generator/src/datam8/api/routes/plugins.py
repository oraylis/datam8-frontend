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

from datam8 import factory, plugins
from datam8_model import data_source as ds
from datam8_model import plugin as pl
from datam8_model.plugin import UiSchema

from .responses import MultiItemResponse, SingleItemResponse

plugins_router = APIRouter(prefix="/plugins", tags=["plugins"])
plugins.init_builtin_plugins()


@plugins_router.get("/")
async def get_plugins() -> MultiItemResponse[pl.PluginManifest]:
    plugin_manifests = factory.get_plugin_manager().get_plugins()
    return MultiItemResponse.from_list(plugin_manifests)


@plugins_router.post("/reload")
async def reload_olugins() -> MultiItemResponse[pl.PluginManifest]:
    manifests = factory.get_plugin_manager().reload(factory.get_model().solution)
    return MultiItemResponse.from_list(manifests)


@plugins_router.get("/{plugin_id}")
async def get_plugin(plugin_id: str) -> SingleItemResponse[pl.PluginManifest]:
    plugins.init_builtin_plugins()
    manifest = factory.get_plugin_manager().get_plugin_manifest(plugin_id)
    return SingleItemResponse(item=manifest)


@plugins_router.get("/{plugin_id}/ui-schema")
async def get_plugin_ui_schema(plugin_id: str) -> SingleItemResponse[UiSchema]:
    ui_schema = factory.get_plugin_manager().get_plugin(plugin_id).get_ui_schema()
    return SingleItemResponse(item=ui_schema)


@plugins_router.get("/{plugin_id}/data-type-mappings")
async def get_data_type_mappings(plugin_id: str) -> MultiItemResponse[ds.SourceDataTypeMapping]:
    data_type_mappings = factory.get_plugin_manager().get_plugin(plugin_id).get_data_type_mappings()
    return MultiItemResponse.from_list(data_type_mappings)


@plugins_router.get("/{plugin_id}/connection-properties")
async def get_connection_properties(plugin_id: str) -> MultiItemResponse[ds.ConnectionProperty]:
    pm = factory.get_plugin_manager()
    PluginClass = pm.get_plugin(plugin_id)
    connection_properties = PluginClass.get_connection_properties()
    return MultiItemResponse.from_list(connection_properties)

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
from typing import Any

from fastapi import APIRouter, HTTPException

from datam8 import factory
from datam8.model import Locator
from datam8_model.data_source import SourceField, SourceObject
from datam8_model.model import ExternalModelSource

from .responses import MultiItemResponse

sources_router = APIRouter(prefix="/sources", tags=["sources"])


@sources_router.get("/{data_source}/test")
async def test_connection(data_source: str) -> None:
    plugin = factory.get_plugin_for_data_source(data_source)
    error = plugin.test_connection()

    if isinstance(error, Exception):
        raise HTTPException(status_code=500, detail=str(error))


#
# schema support
#


@sources_router.get("/{data_source}/schemas")
async def list_schemas(data_source: str) -> MultiItemResponse[str]:
    "List available source schema for a data source"
    plugin = factory.get_plugin_for_data_source(data_source)
    schemas = [x["schema"] for x in plugin.list_schemas().to_dicts()]

    return MultiItemResponse.from_list(schemas)


@sources_router.get("/{data_source}/schemas/{schema}/tables")
async def list_tables_for_schema(data_source: str, schema: str) -> MultiItemResponse[SourceObject]:
    "List available source tables for a datasource connector"
    plugin = factory.get_plugin_for_data_source(data_source)
    tables = [SourceObject.from_dict(o) for o in plugin.list_tables(schema).to_dicts()]
    return MultiItemResponse.from_list(tables)


@sources_router.get("/{data_source}/schemas/{schema}/tables/{table}")
async def get_table_metadata_for_schema(
    data_source: str, schema: str, table: str
) -> MultiItemResponse[SourceField]:
    plugin = factory.get_plugin_for_data_source(data_source)
    metadata = [
        SourceField.from_dict(sf) for sf in plugin.get_table_metadata(table, schema).to_dicts()
    ]
    return MultiItemResponse.from_list(metadata)


@sources_router.get("/{data_source}/schemas/{schema}/tables/{table}/preview")
async def preview_for_schema(
    data_source: str, schema: str, table: str, limit: int = 10
) -> MultiItemResponse[dict[str, Any]]:
    plugin = factory.get_plugin_for_data_source(data_source)
    preview = plugin.preview_data(table, schema, limit=limit)

    for df in preview.collect_batches(chunk_size=limit):
        rows = df.to_dicts()
        return MultiItemResponse.from_list(rows)

    raise HTTPException(status_code=404, detail="No data to preview")


@sources_router.put("/{data_source}/schemas/{schema}/tables/{table}/import")
async def import_for_schema(data_source: str, schema: str, table: str) -> list[dict[str, Any]]:
    raise HTTPException(status_code=404, detail="comming soon...")


#
# no schema support
#


@sources_router.get("/{data_source}/tables")
async def list_tables(data_source: str) -> MultiItemResponse[SourceObject]:
    "List available source tables if a source does not support schemas"
    plugin = factory.get_plugin_for_data_source(data_source)
    tables = [SourceObject.from_dict(o) for o in plugin.list_tables().to_dicts()]
    return MultiItemResponse.from_list(tables)


@sources_router.get("/{data_source}/tables/{table}")
async def get_table_metadata(data_source: str, table: str) -> MultiItemResponse[SourceField]:
    plugin = factory.get_plugin_for_data_source(data_source)
    metadata = [SourceField.from_dict(o) for o in plugin.get_table_metadata(table).to_dicts()]
    return MultiItemResponse.from_list(metadata)


@sources_router.get("/{data_source}/tables/{table}/preview")
async def preview(
    data_source: str, table: str, limit: int = 10
) -> MultiItemResponse[dict[str, Any]]:
    plugin = factory.get_plugin_for_data_source(data_source)
    preview = plugin.preview_data(table, limit=limit)

    for df in preview.collect_batches(chunk_size=limit):
        rows = df.to_dicts()
        return MultiItemResponse.from_list(rows)

    raise HTTPException(status_code=404, detail="No data to preview")


@sources_router.put("/{data_source}/tables/{table}/import")
async def import_for_table(data_source: str, table: str) -> list[dict[str, Any]]:
    raise HTTPException(status_code=404, detail="comming soon...")


#
# additional routes
#


# TODO: not sure what this is supposed to be?
# @sources_router.post("/{data_source}/virtual-table-metadata")
# async def get_virtual_table_metadata(data_source: str, body: TableMetadataBody) -> dict[str, Any]:
#     raise HTTPException(status_code=404, detail="NotImplemented")


@sources_router.get("/{data_source}/usages")
async def get_usages(data_source: str) -> MultiItemResponse[Locator]:
    model_ = factory.get_model()
    ds = model_.get_data_source(data_source)
    entities = [
        wrapper.locator
        for wrapper in factory.get_model().modelEntities.values()
        if ds.entity.name
        in [s.dataSource for s in wrapper.entity.sources if isinstance(s, ExternalModelSource)]
    ]
    return MultiItemResponse.from_list(entities)

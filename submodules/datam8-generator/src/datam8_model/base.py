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

from collections.abc import Sequence
from enum import Enum
from pathlib import Path
from typing import Annotated, Any, Literal, TypeAlias

from pydantic import BaseModel, ConfigDict, Field, RootModel

from . import attribute, data_product, data_source, data_type, folder, model, property, zone


class AttributeTypes(BaseModel):
    """
    Defines the layout of entity files within the `Base` folder.
    """

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        validate_assignment=True,
        revalidate_instances="always",
    )
    type: Literal["attributeTypes"]
    properties: Any | None = None
    propertyValues: Any | None = None
    zones: Any | None = None
    dataTypes: Any | None = None
    dataSourceTypes: Any | None = None
    dataProducts: Any | None = None
    dataModules: Any | None = None
    attributeTypes: Annotated[Sequence[attribute.AttributeType], Field(min_length=1)]
    dataSources: Any | None = None
    folders: Any | None = None
    modelEntities: Any | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj: Any) -> AttributeTypes:
        return AttributeTypes.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> AttributeTypes:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        AttributeTypes
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = AttributeTypes.model_validate_json(file.read())

        return model

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))


class EntityType(Enum):
    PROPERTIES = "properties"
    PROPERTY_VALUES = "propertyValues"
    ZONES = "zones"
    DATA_TYPES = "dataTypes"
    DATA_SOURCE_TYPES = "dataSourceTypes"
    DATA_PRODUCTS = "dataProducts"
    DATA_MODULES = "dataModules"
    ATTRIBUTE_TYPES = "attributeTypes"
    DATA_SOURCES = "dataSources"
    FOLDERS = "folders"
    MODEL_ENTITIES = "modelEntities"


class PropertyValues(BaseModel):
    """
    Defines the layout of entity files within the `Base` folder.
    """

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        validate_assignment=True,
        revalidate_instances="always",
    )
    type: Literal["propertyValues"]
    properties: Any | None = None
    propertyValues: Sequence[property.PropertyValue]
    zones: Any | None = None
    dataTypes: Any | None = None
    dataSourceTypes: Any | None = None
    dataProducts: Any | None = None
    dataModules: Any | None = None
    attributeTypes: Any | None = None
    dataSources: Any | None = None
    folders: Any | None = None
    modelEntities: Any | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj: Any) -> PropertyValues:
        return PropertyValues.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> PropertyValues:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        PropertyValues
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = PropertyValues.model_validate_json(file.read())

        return model

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))


class Zones(BaseModel):
    """
    Defines the layout of entity files within the `Base` folder.
    """

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        validate_assignment=True,
        revalidate_instances="always",
    )
    type: Literal["zones"]
    properties: Any | None = None
    propertyValues: Any | None = None
    zones: Sequence[zone.Zone]
    dataTypes: Any | None = None
    dataSourceTypes: Any | None = None
    dataProducts: Any | None = None
    dataModules: Any | None = None
    attributeTypes: Any | None = None
    dataSources: Any | None = None
    folders: Any | None = None
    modelEntities: Any | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj: Any) -> Zones:
        return Zones.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> Zones:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        Zones
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = Zones.model_validate_json(file.read())

        return model

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))


class DataTypes(BaseModel):
    """
    Defines the layout of entity files within the `Base` folder.
    """

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        validate_assignment=True,
        revalidate_instances="always",
    )
    type: Literal["dataTypes"]
    properties: Any | None = None
    propertyValues: Any | None = None
    zones: Any | None = None
    dataTypes: Annotated[Sequence[data_type.DataTypeDefinition], Field(min_length=1)]
    dataSourceTypes: Any | None = None
    dataProducts: Any | None = None
    dataModules: Any | None = None
    attributeTypes: Any | None = None
    dataSources: Any | None = None
    folders: Any | None = None
    modelEntities: Any | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj: Any) -> DataTypes:
        return DataTypes.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> DataTypes:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        DataTypes
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = DataTypes.model_validate_json(file.read())

        return model

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))


class DataSourceTypes(BaseModel):
    """
    Defines the layout of entity files within the `Base` folder.
    """

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        validate_assignment=True,
        revalidate_instances="always",
    )
    type: Literal["dataSourceTypes"]
    properties: Any | None = None
    propertyValues: Any | None = None
    zones: Any | None = None
    dataTypes: Any | None = None
    dataSourceTypes: Sequence[data_source.DataSourceType]
    dataProducts: Any | None = None
    dataModules: Any | None = None
    attributeTypes: Any | None = None
    dataSources: Any | None = None
    folders: Any | None = None
    modelEntities: Any | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj: Any) -> DataSourceTypes:
        return DataSourceTypes.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> DataSourceTypes:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        DataSourceTypes
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = DataSourceTypes.model_validate_json(file.read())

        return model

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))


class Folders(BaseModel):
    """
    Defines the layout of entity files within the `Base` folder.
    """

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        validate_assignment=True,
        revalidate_instances="always",
    )
    type: Literal["folders"]
    properties: Any | None = None
    propertyValues: Any | None = None
    zones: Any | None = None
    dataTypes: Any | None = None
    dataSourceTypes: Any | None = None
    dataProducts: Any | None = None
    dataModules: Any | None = None
    attributeTypes: Any | None = None
    dataSources: Any | None = None
    folders: Annotated[Sequence[folder.Folder], Field(min_length=1)]
    modelEntities: Any | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj: Any) -> Folders:
        return Folders.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> Folders:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        Folders
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = Folders.model_validate_json(file.read())

        return model

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))


class Properties(BaseModel):
    """
    Defines the layout of entity files within the `Base` folder.
    """

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        validate_assignment=True,
        revalidate_instances="always",
    )
    type: Literal["properties"]
    properties: Sequence[property.Property]
    propertyValues: Any | None = None
    zones: Any | None = None
    dataTypes: Any | None = None
    dataSourceTypes: Any | None = None
    dataProducts: Any | None = None
    dataModules: Any | None = None
    attributeTypes: Any | None = None
    dataSources: Any | None = None
    folders: Any | None = None
    modelEntities: Any | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj: Any) -> Properties:
        return Properties.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> Properties:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        Properties
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = Properties.model_validate_json(file.read())

        return model

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))


class DataModules(BaseModel):
    """
    Defines the layout of entity files within the `Base` folder.
    """

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        validate_assignment=True,
        revalidate_instances="always",
    )
    type: Literal["dataModules"]
    properties: Any | None = None
    propertyValues: Any | None = None
    zones: Any | None = None
    dataTypes: Any | None = None
    dataSourceTypes: Any | None = None
    dataProducts: Any | None = None
    dataModules: Annotated[Sequence[data_product.DataModule], Field(min_length=1)]
    attributeTypes: Any | None = None
    dataSources: Any | None = None
    folders: Any | None = None
    modelEntities: Any | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj: Any) -> DataModules:
        return DataModules.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> DataModules:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        DataModules
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = DataModules.model_validate_json(file.read())

        return model

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))


class DataSources(BaseModel):
    """
    Defines the layout of entity files within the `Base` folder.
    """

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        validate_assignment=True,
        revalidate_instances="always",
    )
    type: Literal["dataSources"]
    properties: Any | None = None
    propertyValues: Any | None = None
    zones: Any | None = None
    dataTypes: Any | None = None
    dataSourceTypes: Any | None = None
    dataProducts: Any | None = None
    dataModules: Any | None = None
    attributeTypes: Any | None = None
    dataSources: Sequence[data_source.DataSource]
    folders: Any | None = None
    modelEntities: Any | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj: Any) -> DataSources:
        return DataSources.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> DataSources:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        DataSources
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = DataSources.model_validate_json(file.read())

        return model

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))


class DataProducts(BaseModel):
    """
    Defines the layout of entity files within the `Base` folder.
    """

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        validate_assignment=True,
        revalidate_instances="always",
    )
    type: Literal["dataProducts"]
    properties: Any | None = None
    propertyValues: Any | None = None
    zones: Any | None = None
    dataTypes: Any | None = None
    dataSourceTypes: Any | None = None
    dataProducts: Sequence[data_product.DataProduct]
    dataModules: Any | None = None
    attributeTypes: Any | None = None
    dataSources: Any | None = None
    folders: Any | None = None
    modelEntities: Any | None = None

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj: Any) -> DataProducts:
        return DataProducts.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> DataProducts:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        DataProducts
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = DataProducts.model_validate_json(file.read())

        return model

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))


class ModelEntities(BaseModel):
    """
    Defines the layout of entity files within the `Base` folder.
    """

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        validate_assignment=True,
        revalidate_instances="always",
    )
    type: Literal["modelEntities"]
    properties: Any | None = None
    propertyValues: Any | None = None
    zones: Any | None = None
    dataTypes: Any | None = None
    dataSourceTypes: Any | None = None
    dataProducts: Any | None = None
    dataModules: Any | None = None
    attributeTypes: Any | None = None
    dataSources: Any | None = None
    folders: Any | None = None
    modelEntities: Sequence[model.ModelEntity]

    def to_dict(self) -> dict:
        return self.model_dump(by_alias=True, exclude_unset=True, mode="json")

    @staticmethod
    def from_dict(obj: Any) -> ModelEntities:
        return ModelEntities.model_validate(obj, from_attributes=False)

    @staticmethod
    def from_json_file(path: Path) -> ModelEntities:
        """Loads ands validates a json file from the given path.

        Parameters
        ----------
        path : Path
          The path to the json to be loaded into the model.

        Returns
        -------
        ModelEntities
            Instantiated and validated pydantic model

        Raises
        ------
        ValidationError
            If the data in the json file does not much the model constraints.
        """
        with open(path) as file:
            model = ModelEntities.model_validate_json(file.read())

        return model

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))


# ruff: disable[UP040]
# HACK: pydantic is not able to probably validate a PEP 695 type alias declaration, only seems to work with
# the legacy TypeAlias from typing
BaseEntitiesType: TypeAlias = (
    ModelEntities
    | Folders
    | Properties
    | PropertyValues
    | Zones
    | DataTypes
    | DataSourceTypes
    | DataProducts
    | DataModules
    | AttributeTypes
    | DataSources
)
"""
Defines the layout of entity files within the `Base` folder.
"""
# ruff: enable[UP040]


class BaseEntities(
    RootModel[
        ModelEntities
        | Folders
        | Properties
        | PropertyValues
        | Zones
        | DataTypes
        | DataSourceTypes
        | DataProducts
        | DataModules
        | AttributeTypes
        | DataSources
    ]
):
    root: Annotated[
        ModelEntities
        | Folders
        | Properties
        | PropertyValues
        | Zones
        | DataTypes
        | DataSourceTypes
        | DataProducts
        | DataModules
        | AttributeTypes
        | DataSources,
        Field(title="BaseEntities"),
    ]
    """
    Defines the layout of entity files within the `Base` folder.
    """

    @staticmethod
    def from_json_file(path: Path) -> BaseEntities:
        with open(path) as file:
            model = BaseEntities.model_validate_json(file.read())

        return model

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))


# ruff: disable[UP040]
# HACK: pydantic is not able to probably validate a PEP 695 type alias declaration, only seems to work with
# the legacy TypeAlias from typing
BaseEntityType: TypeAlias = (
    property.Property
    | property.PropertyValue
    | zone.Zone
    | data_type.DataTypeDefinition
    | data_source.DataSourceType
    | data_product.DataProduct
    | data_product.DataModule
    | attribute.AttributeType
    | data_source.DataSource
    | folder.Folder
    | model.ModelEntity
)
"""
A union type for all internal objects.
"""
# ruff: enable[UP040]


class BaseEntity(
    RootModel[
        property.Property
        | property.PropertyValue
        | zone.Zone
        | data_type.DataTypeDefinition
        | data_source.DataSourceType
        | data_product.DataProduct
        | data_product.DataModule
        | attribute.AttributeType
        | data_source.DataSource
        | folder.Folder
        | model.ModelEntity
    ]
):
    root: (
        property.Property
        | property.PropertyValue
        | zone.Zone
        | data_type.DataTypeDefinition
        | data_source.DataSourceType
        | data_product.DataProduct
        | data_product.DataModule
        | attribute.AttributeType
        | data_source.DataSource
        | folder.Folder
        | model.ModelEntity
    )
    """
    A union type for all internal objects.
    """

    @staticmethod
    def from_json_file(path: Path) -> BaseEntity:
        with open(path) as file:
            model = BaseEntity.model_validate_json(file.read())

        return model

    def to_json_file(self, path: Path, mode: str, dump_options: dict[str, Any]) -> None:
        with open(path, mode) as file:
            file.write(self.model_dump_json(**dump_options))

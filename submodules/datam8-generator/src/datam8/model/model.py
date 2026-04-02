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
from collections.abc import Iterator, Sequence
from pathlib import Path
from typing import Annotated, Any, cast

from pydantic import ConfigDict, Field, ValidationError

from datam8 import config, errors, logging, opts, plugins, utils
from datam8_model import attribute as a
from datam8_model import base as b
from datam8_model import data_product as dp
from datam8_model import data_source as ds
from datam8_model import data_type as dt
from datam8_model import folder as f
from datam8_model import model as m
from datam8_model import property as p
from datam8_model import solution as s
from datam8_model import zone as z

from .entity_wrapper import EntityDict, EntityWrapper, EntityWrapperVariant
from .locator import ROOT_LOCATOR, Locator, _ensure_locator

logger = logging.getLogger(__name__)

MODEL_DUMP_OPTIONS: dict[str, Any] = {
    "indent": 2,
    "exclude_defaults": True,
    "exclude_none": True,
}


def class_from_type(_type: b.EntityType) -> type[b.BaseEntityType]:
    match _type:
        case b.EntityType.PROPERTIES:
            _class = p.Property
        case b.EntityType.PROPERTY_VALUES:
            _class = p.PropertyValue
        case b.EntityType.ZONES:
            _class = z.Zone
        case b.EntityType.MODEL_ENTITIES:
            _class = m.ModelEntity
        case b.EntityType.FOLDERS:
            _class = f.Folder
        case b.EntityType.DATA_TYPES:
            _class = dt.DataTypeDefinition
        case b.EntityType.DATA_SOURCES:
            _class = ds.DataSource
        case b.EntityType.DATA_SOURCE_TYPES:
            _class = ds.DataSourceType
        case b.EntityType.DATA_PRODUCTS:
            _class = dp.DataProduct
        case b.EntityType.DATA_MODULES:
            _class = dp.DataModule
        case b.EntityType.ATTRIBUTE_TYPES:
            _class = a.AttributeType

    return _class


def _default_base_file_name_for_type(_type: b.EntityType) -> str:
    match _type:
        case b.EntityType.PROPERTIES:
            return "Properties.json"
        case b.EntityType.PROPERTY_VALUES:
            return "PropertyValues.json"
        case b.EntityType.ZONES:
            return "Zones.json"
        case b.EntityType.DATA_TYPES:
            return "DataTypes.json"
        case b.EntityType.DATA_SOURCE_TYPES:
            return "DataSourceTypes.json"
        case b.EntityType.DATA_PRODUCTS:
            return "DataProducts.json"
        case b.EntityType.DATA_MODULES:
            return "DataModules.json"
        case b.EntityType.ATTRIBUTE_TYPES:
            return "AttributeTypes.json"
        case b.EntityType.DATA_SOURCES:
            return "DataSources.json"
        case _:
            return f"{_type.value}.json"


class PropertyReference(p.PropertyReference):
    """
    Sub-class of `datam8.property.PropertyReference` for actual use with the
    generator offering further functionality.
    """

    def __eq__(self, other: object) -> bool:
        if isinstance(other, p.PropertyReference):
            return self.property == other.property and self.value == other.value
        elif not isinstance(other, PropertyReference):
            return False

        return self.property == other.property and self.value == other.value

    def __hash__(self):
        return hash((self.property, self.value))

    @staticmethod
    def from_model_ref(ref: p.PropertyReference, /):
        """
        Converts a PropertyReference parsed from a json file into the
        internally used one.

        # Parameters
        ----------
        ref : `datam8_model.property.PropertyReference`
            Reference to a property value, directly parsed from the json files.
        """
        return PropertyReference(
            property=ref.property,
            value=ref.value,
        )


class Model:
    """
    The main class that all data from the datam8 solution will be stored in.

    It will also be the main interface for use in templates. Nothing else should
    be available there directly.
    """

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
    )
    solution: Annotated[s.Solution, Field(frozen=True)]
    properties: EntityDict[p.Property]
    propertyValues: EntityDict[p.PropertyValue]
    zones: EntityDict[z.Zone]
    dataTypes: EntityDict[dt.DataTypeDefinition]
    dataSources: EntityDict[ds.DataSource]
    dataSourceTypes: EntityDict[ds.DataSourceType]
    dataProducts: EntityDict[dp.DataProduct]
    dataModules: EntityDict[dp.DataModule]
    attributeTypes: EntityDict[a.AttributeType]
    folders: EntityDict[f.Folder]
    modelEntities: EntityDict[m.ModelEntity]

    def __init__(self, solution: s.Solution, /, **kwargs: EntityDict):
        self.solution = solution

        for k, v in kwargs.items():
            setattr(self, k, v)

        self._model_files: dict[Path, EntityFileRef] = {}
        """Internal dictionary to allow easy mapping of files and their entities"""

        if len(self.modelEntities) == 0:
            self.__next_model_id = 1
        else:
            self.__next_model_id = max([w.entity.id for w in self.modelEntities.values()]) + 1

        self.plugin_manager = plugins.PluginManager()

    def get_next_model_id(self) -> int:
        next = self.__next_model_id
        self.__next_model_id += 1
        return next

    def init_file_references(self) -> None:
        self._model_files = {}

        for _wrapper in self.get_entity_iterator():
            if _wrapper.source_file not in self._model_files:
                self._model_files[_wrapper.source_file] = EntityFileRef(
                    _type=b.EntityType(_wrapper.locator.entityType), file_path=_wrapper.source_file
                )

            self._model_files[_wrapper.source_file].locators.append(_wrapper.locator)

    def update_file_reference(
        self, *, _type: b.EntityType, file_path: Path, locators: list[Locator] | None = None
    ) -> None:
        if file_path not in self._model_files:
            logger.debug(f"Adding new file ref for {file_path}")
            self._model_files[file_path] = EntityFileRef(_type, file_path)

        if locators is not None and len(locators) > 0:
            logger.debug(f"Adding {locators} to {file_path}")
            self._model_files[file_path].locators.extend(locators)

    def resolve_wrapper[T: b.BaseEntityType](
        self, wrapper: EntityWrapper[T], /
    ) -> EntityWrapper[T]:
        """
        Recursively lookup concrete property value objects and write them to
        `EntityWrapper.properties`

        Parameters
        ----------
        model : `model.Model`
            The DataM8 model to lookup up the property values. This normally is the same
            model as the one this EntityWrapper resides in, but could also be a sperate model.

        Returns
        -------
        `EntityWrapper[T]`
            The resolved entity itself.
        """
        if wrapper.resolved:
            logger.warning(
                "Tried resolving an already resolved entity, this should not be done"
                f" - {wrapper.locator}"
            )
            return wrapper

        if not hasattr(wrapper.entity, "properties"):
            wrapper.resolved = True
            return wrapper

        local_property_references: list[p.PropertyReference] = list(
            getattr(wrapper.entity, "properties") or []
        )
        property_references: list[p.PropertyReference] = local_property_references + [
            pr
            for pr in self.get_inherited_property_references(wrapper)
            # NOTE: properties set on the entity itself takes precedene to
            # inherited properties
            if pr not in local_property_references
        ]

        if len(property_references) > 0:
            self._resolve_properties(wrapper, property_references)

        self._resolve_model_attributes(wrapper)
        wrapper.resolved = True

        logger.info("Resolved %s", str(wrapper.locator))

        return wrapper

    def _resolve_model_attributes[T: b.BaseEntityType](self, wrapper: EntityWrapper[T], /) -> None:
        if not isinstance(wrapper.entity, m.ModelEntity):
            return

        for attr in wrapper.entity.attributes:
            pass
            # logger.error(attr.properties)

    def resolve(self) -> None:
        "Resolve all entities by iterating over them."
        for wrapper in self.get_entity_iterator():
            self.resolve_wrapper(wrapper)

    def get_inherited_property_references[T: b.BaseEntityType](
        self, wrapper: EntityWrapper[T], /
    ) -> list[p.PropertyReference]:
        """
        Get a distinct list of properties of parent Entities (most likely foldres).

        Returns
        -------
        `list[PropertyReference]`
            A list of PropertyReference of parent locators. They are not yet resolved recursivley.
        """
        parent_properties: list[p.PropertyReference] = []

        for parent in wrapper.locator.parents:
            if parent not in self.folders:
                continue

            parent_folder = self.folders[parent].entity

            if not parent_folder.properties:
                continue

            parent_properties.extend(
                iter([pr for pr in parent_folder.properties if pr not in parent_properties])
            )

        # in case the entity is a model also get the zones properties
        if wrapper.locator.entityType == b.EntityType.MODEL_ENTITIES.value:
            zone = self.get_zone_for_entity(wrapper)  # ty: ignore[invalid-argument-type]
            if not zone.resolved:
                self.resolve_wrapper(zone)

            if zone.entity.properties is not None:
                parent_properties.extend(
                    iter([pr for pr in zone.entity.properties if pr not in parent_properties])
                )

        return parent_properties

    def _resolve_properties[T: b.BaseEntityType](
        self, wrapper: EntityWrapper[T], /, properties: Sequence[p.PropertyReference]
    ) -> None:
        """
        Recursivly resolve properties assigned to this entity, directly or indirectly via
        folders.

        Parent property references are currently only being resolved for modelEntities.

        Parameters
        ----------
        model : `model.model`
            The DataM8 model to lookup up the property values. This normally is the same
            model as the one this EntityWrapper resides in, but could technically be a
            sperate model.
        properties : `Sequence[PropertyReference]`
            PropertyReferences that should be looked up recursively.
        """
        if len(properties) == 0:
            return

        converted_properties = [PropertyReference.from_model_ref(pr) for pr in properties]

        logger.debug(
            "%s - %s",
            wrapper.locator,
            [f"{p.property}:{p.value}" for p in converted_properties],
        )

        for ref in converted_properties:
            property_value = self.get_property_value(ref.value, ref.property)
            wrapper._properties[property_value.locator] = property_value.entity

            # NOTE: break recursion
            if property_value.entity.properties:
                self._resolve_properties(wrapper, property_value.entity.properties)

    def get_entity_iterator(self) -> Iterator[EntityWrapperVariant]:
        for entity_type in b.EntityType:
            entities: EntityDict = getattr(self, entity_type.value)
            logger.log(5, f"Iterating... {entity_type}")

            for _, wrapper in entities.items():
                logger.log(5, f"Iterating... {str(wrapper.locator)}")
                yield wrapper

    def get_generator_target(self, name: str, /) -> s.GeneratorTarget:
        if name == opts.default_target:
            return self.get_generator_default_target()

        for target in self.solution.generatorTargets:
            if target.name == name:
                return target

        raise utils.create_error(errors.InvalidGeneratorTargetError(name))

    def get_generator_default_target(self) -> s.GeneratorTarget:
        default_targets = list(filter(lambda t: t.isDefault, self.solution.generatorTargets))

        match len(default_targets):
            case 0:
                raise Exception("No default target defined")
            case 1:
                return default_targets.pop()
            case _:
                raise Exception("Multiple default targets defined")

    def _get_entity[T: b.BaseEntityType](
        self, name: str, /, entity_type: b.EntityType, *, entity_dict: EntityDict[T]
    ) -> EntityWrapper[T]:
        locator = Locator.from_path(f"{entity_type.value}/{name}")

        if locator not in entity_dict:
            raise errors.EntityNotFoundError(f"{entity_type} {name}")

        entity = entity_dict[locator]

        if not entity.resolved:
            self.resolve_wrapper(entity)

        return entity

    def get_zone_for_entity(
        self, wrapper: EntityWrapper[m.ModelEntity], /
    ) -> EntityWrapper[z.Zone]:
        if len(wrapper.locator.folders) == 0:
            raise utils.create_error(errors.InvalidLocatorError(str(wrapper.locator)))

        for zone in self.zones.values():
            if zone.entity.localFolderName == wrapper.locator.folders[0]:
                return zone

        raise utils.create_error(errors.EntityNotFoundError(f"zones/{wrapper.locator.folders[0]}"))

    def get_zone(self, name: str, /) -> EntityWrapper[z.Zone]:
        """Get a zone by name."""
        wrapped_zone = self._get_entity(name, b.EntityType.ZONES, entity_dict=self.zones)
        return wrapped_zone

    def get_data_type(self, name: str, /) -> EntityWrapper[dt.DataTypeDefinition]:
        """Get a data type by name."""
        wrapped_data_type = self._get_entity(
            name, b.EntityType.DATA_TYPES, entity_dict=self.dataTypes
        )
        return wrapped_data_type

    def get_data_source(self, name: str, /) -> EntityWrapper[ds.DataSource]:
        """Get a data source by name."""
        wrapped_data_source = self._get_entity(
            name, b.EntityType.DATA_SOURCES, entity_dict=self.dataSources
        )
        return wrapped_data_source

    def get_data_source_type(self, name: str, /) -> EntityWrapper[ds.DataSourceType]:
        """Get a data source type by name."""
        wrapped_data_source_type = self._get_entity(
            name, b.EntityType.DATA_SOURCE_TYPES, entity_dict=self.dataSourceTypes
        )
        return wrapped_data_source_type

    def get_data_product(self, name: str, /) -> EntityWrapper[dp.DataProduct]:
        """Get a data product by name."""
        wrapped_data_product = self._get_entity(
            name, b.EntityType.DATA_PRODUCTS, entity_dict=self.dataProducts
        )
        return wrapped_data_product

    def get_data_module(self, name: str, /, data_product: str) -> dp.DataModule:
        """Get a data module for a data  product by name."""
        _data_product = self._get_entity(
            data_product, b.EntityType.DATA_PRODUCTS, entity_dict=self.dataProducts
        )

        # TODO: split data module up from data product and fill `self.dataModules`
        for data_module in _data_product.entity.dataModules:
            if data_module.name == name:
                return data_module

        raise errors.EntityNotFoundError(f"dataModule {data_product}:{name}")

    def get_attribute_type(self, name: str, /) -> EntityWrapper[a.AttributeType]:
        """Get an attribute type by name."""
        wrapped_attribute_type = self._get_entity(
            name, b.EntityType.ATTRIBUTE_TYPES, entity_dict=self.attributeTypes
        )
        return wrapped_attribute_type

    def get_property(self, name: str, /) -> EntityWrapper[p.Property]:
        """Get a property by name."""
        wrapped_property = self._get_entity(
            name, b.EntityType.PROPERTIES, entity_dict=self.properties
        )
        return wrapped_property

    def get_property_value(self, name: str, /, property: str) -> EntityWrapper[p.PropertyValue]:
        """Get a property value by its property and name."""
        property_values = [
            pv
            for pv in self.propertyValues.values()
            if pv.entity.property == property and pv.entity.name == name
        ]

        if len(property_values) != 1:
            raise errors.EntityNotFoundError(f"property value {property}/{name}")

        property_value = property_values.pop()

        if not property_value.resolved:
            return self.resolve_wrapper(property_value)

        return property_value

    def get_folder(self, name: str, /) -> EntityWrapper[f.Folder]:
        """Get a folder by name."""
        wrapped_folder = self._get_entity(name, b.EntityType.FOLDERS, entity_dict=self.folders)
        return wrapped_folder

    def get_model_entity_by_id(self, id: int, /) -> EntityWrapper[m.ModelEntity]:
        """
        Retrieves a model entity by its id.

        Parameters
        ----------
        id : `int`
            The numeric id of the entity. Unrelated to the dynamic locator.

        Returns
        -------
        `EntityWrapper[ModelEntity]`

        Raises
        ------
        `EntityNotFoundError`
            When no model entity was found with this id.
        """
        for entity in self.modelEntities.values():
            if entity.entity.id == id:
                if not entity.resolved:
                    return self.resolve_wrapper(entity)
                return entity

        raise errors.EntityNotFoundError(f"Model Id {id}")

    def has_locator(self, locator: Locator | str, /) -> bool:
        locator_ = _ensure_locator(locator)
        wrapper = getattr(self, locator_.entityType).get(locator_)

        if wrapper is None:
            return False
        else:
            return True

    def get_entity_by_locator(self, locator: str | Locator, /) -> EntityWrapperVariant:
        """
        Retrieve a single entity by its locator.

        This is implemented as a directy dictionary key lookup, and will fail if
        the entity / locator does not exist.

        Parameters
        ----------
        locator : `str` or `Locator`
            The locator of the entity to retrieve.

        Returns
        -------
        `EntityWrapper`
            Of an unkown entity type. Needs to be type hinted manually if required.
        """
        locator = _ensure_locator(locator)

        if self.has_locator(locator):
            wrapper: EntityWrapper[b.BaseEntityType] = getattr(self, locator.entityType)[locator]
        else:
            raise utils.create_error(errors.EntityNotFoundError(str(locator)))

        if wrapper.is_deleted:
            raise utils.create_error(Exception("Entity has been deleted"))

        if not wrapper.resolved:
            self.resolve_wrapper(wrapper)

        return wrapper

    def get_base_path_for_entity_type(self, _type: b.EntityType, /) -> Path:

        match _type:
            case b.EntityType.MODEL_ENTITIES | b.EntityType.FOLDERS:
                base_file_path = config.solution_folder_path / self.solution.modelPath
            case _:
                base_file_path = config.solution_folder_path / self.solution.basePath

        return base_file_path

    def add_entity(
        self, locator: Locator | str, /, content: dict[str, Any]
    ) -> EntityWrapper[b.BaseEntityType]:
        _locator = _ensure_locator(locator)
        _type = b.EntityType(_locator.entityType)

        base_file_path = self.get_base_path_for_entity_type(_type)
        if _type == b.EntityType.MODEL_ENTITIES:
            source_file_path = Path(base_file_path, *_locator.folders, f"{_locator.entityName}.json")
        elif _type == b.EntityType.FOLDERS:
            if _locator.entityName is None:
                raise utils.create_error(
                    Exception("Folder locator must include entityName when adding a folder entity")
                )
            source_file_path = Path(
                base_file_path,
                *_locator.folders,
                _locator.entityName,
                ".properties.json",
            )
        else:
            existing_refs = [
                ref.file_path
                for ref in self._model_files.values()
                if ref._type == _type
            ]
            if existing_refs:
                source_file_path = sorted(existing_refs, key=lambda p: len(str(p)))[0]
            else:
                source_file_path = Path(base_file_path, *_locator.folders) / _default_base_file_name_for_type(_type)

        content["name"] = _locator.entityName
        if _type == b.EntityType.MODEL_ENTITIES:
            content["id"] = self.get_next_model_id()

        try:
            new_wrapper = EntityWrapper(
                locator=_locator,
                source_file=source_file_path,
                entity=class_from_type(_type).from_dict(content),
            )
            new_wrapper._changed = True
            self.resolve_wrapper(new_wrapper)
        except ValidationError as err:
            raise utils.create_error(err)

        entity_dict: EntityDict[b.BaseEntityType] = getattr(self, _type.value)

        if _locator in entity_dict:
            raise utils.create_error(Exception(f"Locator already exists in model: {_locator}"))

        entity_dict[_locator] = new_wrapper

        self.update_file_reference(
            _type=_type, file_path=source_file_path, locators=[new_wrapper.locator]
        )

        return new_wrapper

    def clone_entity(
        self,
        locator: Locator | str,
        /,
        new_locator: Locator | str,
    ) -> EntityWrapper[b.BaseEntityType]:
        to_clone = _ensure_locator(locator)
        new_locator = _ensure_locator(new_locator)

        if to_clone.entityType != new_locator.entityType:
            raise utils.create_error(
                Exception(
                    "The entity type of both locators need to be the same when cloning an entity"
                )
            )

        cloned_entity: dict[str, Any] = (
            self.get_entity_by_locator(to_clone).entity.model_copy().model_dump()
        )
        new_wrapper = self.add_entity(new_locator, cloned_entity)

        return new_wrapper

    def _get_subtree_root_locator(self, locator: Locator) -> Locator:
        if locator.entityName is None:
            return locator

        return Locator(
            entityType=locator.entityType,
            folders=[*locator.folders, locator.entityName],
            entityName=None,
        )


    def get_entities_for_locator(self, locator: Locator | str) -> list[EntityWrapperVariant]:
        search_locator = _ensure_locator(locator)
        entities: list[EntityWrapperVariant] = []
        seen_locators: set[Locator] = set()

        def _add(wrapper: EntityWrapperVariant) -> None:
            if wrapper.locator in seen_locators:
                return
            entities.append(wrapper)
            seen_locators.add(wrapper.locator)

        if self.has_locator(search_locator):
            _add(self.get_entity_by_locator(search_locator))

        if search_locator.entityType == b.EntityType.FOLDERS.value:
            folder_subtree_root = self._get_subtree_root_locator(search_locator)

            for wrapper in self.get_entity_iterator():
                if (
                    wrapper.locator.entityType == b.EntityType.FOLDERS.value
                    and wrapper.locator in folder_subtree_root
                ):
                    _add(wrapper)

            model_subtree_root = Locator(
                entityType=b.EntityType.MODEL_ENTITIES.value,
                folders=folder_subtree_root.folders,
                entityName=None,
            )

            for wrapper in self.get_entity_iterator():
                if (
                    wrapper.locator.entityType == b.EntityType.MODEL_ENTITIES.value
                    and wrapper.locator in model_subtree_root
                ):
                    _add(wrapper)

            return entities

        if search_locator.entityName is None:
            for wrapper in self.get_entities(search_locator):
                _add(wrapper)

        return entities


    def _get_rebased_locator(
        self,
        current: Locator,
        *,
        from_root: Locator,
        to_root: Locator,
    ) -> Locator:
        def _parts(locator: Locator) -> list[str]:
            return [*locator.folders, *([locator.entityName] if locator.entityName else [])]

        from_parts = _parts(from_root)
        to_parts = _parts(to_root)
        current_parts = _parts(current)

        relative_parts = current_parts[len(from_parts) :]
        rebased_parts = [*to_parts, *relative_parts]

        if current.entityName is None:
            return Locator(
                entityType=current.entityType,
                folders=rebased_parts,
                entityName=None,
            )

        if len(rebased_parts) == 0:
            raise utils.create_error(Exception("Cannot move entity to an empty locator"))

        return Locator(
            entityType=current.entityType,
            folders=rebased_parts[:-1],
            entityName=rebased_parts[-1],
        )

    def delete_entities(self, locator: Locator | str, /) -> list[Locator]:
        wrappers = self.get_entities_for_locator(locator)

        if len(wrappers) == 0:
            raise utils.create_error(errors.InvalidLocatorError(str(locator)))

        for wrapper in wrappers:
            wrapper._deleted = True

        return [wrapper.locator for wrapper in wrappers]

    def delete_entity(self, locator: Locator, /) -> None:
        if locator.entityName is None:
            raise utils.create_error("When deleting an entity, the locator must point to an entity")

        self.delete_entities(locator)

    def move_entities(
        self, _from: Locator | str, /, _to: Locator | str
    ) -> list[EntityWrapperVariant]:
        from_locator = _ensure_locator(_from)
        to_locator = _ensure_locator(_to)

        if from_locator == to_locator:
            return []

        wrappers_to_move = self.get_entities_for_locator(from_locator)

        if len(wrappers_to_move) == 0:
            raise utils.create_error(errors.InvalidLocatorError(str(_from)))

        new_wrappers: list[EntityWrapperVariant] = []

        if from_locator.entityType == b.EntityType.FOLDERS.value:
            folder_from_root = self._get_subtree_root_locator(from_locator)
            folder_to_root = self._get_subtree_root_locator(to_locator)

            model_from_root = Locator(
                entityType=b.EntityType.MODEL_ENTITIES.value,
                folders=folder_from_root.folders,
                entityName=None,
            )
            model_to_root = Locator(
                entityType=b.EntityType.MODEL_ENTITIES.value,
                folders=folder_to_root.folders,
                entityName=None,
            )

            for wrapper in wrappers_to_move:
                if wrapper.locator.entityType == b.EntityType.FOLDERS.value:
                    target_locator = self._get_rebased_locator(
                        wrapper.locator,
                        from_root=folder_from_root,
                        to_root=folder_to_root,
                    )
                elif wrapper.locator.entityType == b.EntityType.MODEL_ENTITIES.value:
                    target_locator = self._get_rebased_locator(
                        wrapper.locator,
                        from_root=model_from_root,
                        to_root=model_to_root,
                    )
                else:
                    continue

                new_wrappers.append(self.move_entity(wrapper.locator, target_locator))

        else:
            from_root = self._get_subtree_root_locator(from_locator)
            to_root = self._get_subtree_root_locator(to_locator)

            for wrapper in wrappers_to_move:
                target_locator = self._get_rebased_locator(
                    wrapper.locator,
                    from_root=from_root,
                    to_root=to_root,
                )
                new_wrappers.append(self.move_entity(wrapper.locator, target_locator))

        logger.debug("%s entities have been moved to %s", len(new_wrappers), str(to_locator))

        return new_wrappers

    def move_entity(
        self, _from: Locator, /, _to: Locator, *, force: bool = False
    ) -> EntityWrapperVariant:
        if _from.entityName is None:
            raise utils.create_error(
                Exception(
                    "When moving an entity a locator pointing to a single entity must be used"
                )
            )

        new_locator = _to.clone()
        new_locator.entityType = _from.entityType
        new_locator.entityName = _to.entityName or _from.entityName
        if new_locator.entityName is None:
            raise utils.create_error(
                Exception("Target locator must include entityName when moving an entity")
            )

        if self.has_locator(new_locator) and not force:
            raise utils.create_error(
                Exception(f"Target of entity move does already exist: {new_locator}")
            )

        entity_dict: EntityDict[b.BaseEntityType] = getattr(self, _from.entityType)

        # create a copy from the old wrapper and mark it for deletion
        from_wrapper = self.get_entity_by_locator(_from)
        from_wrapper._deleted = True

        # reset the cloned wrapper with the new locator and mark it as changed and resolv property references
        _type = b.EntityType(_from.entityType)

        if _type == b.EntityType.FOLDERS:
            new_source_file = Path(
                self.get_base_path_for_entity_type(_type),
                *new_locator.folders,
                new_locator.entityName,
                ".properties.json",
            )
        else:
            new_source_file = Path(
                self.get_base_path_for_entity_type(_type),
                *new_locator.folders,
                new_locator.entityName,
            ).with_suffix(".json")
        to_wrapper = from_wrapper.model_copy(deep=True)
        to_wrapper.reset(new_locator, source_file=new_source_file)

        if hasattr(to_wrapper.entity, "name") and new_locator.entityName is not None:
            to_wrapper.entity.name = new_locator.entityName

        if _type == b.EntityType.FOLDERS and isinstance(to_wrapper.entity, f.Folder):
            to_wrapper.entity.path = "/".join([*new_locator.folders, new_locator.entityName])
        self.resolve_wrapper(to_wrapper)
        to_wrapper._changed = True

        entity_dict[new_locator] = to_wrapper

        self.update_file_reference(
            _type=_type, file_path=new_source_file, locators=[to_wrapper.locator]
        )

        logger.debug(f"Moved {_from} to {new_locator}")

        return to_wrapper

    def get_entities_by_property(
        self,
        property_locator: str | Locator,
        /,
        model_locator: str | Locator = "modelEntities/",
    ):
        locator = _ensure_locator(property_locator)
        if locator.entityName is None or locator.entityType not in [
            b.EntityType.PROPERTIES.value,
            b.EntityType.PROPERTY_VALUES.value,
        ]:
            raise utils.create_error(errors.InvalidLocatorError(str(locator)))

        property_value = self.get_entity_by_locator(locator)
        results = [
            wrapper
            for wrapper in self.get_entities(model_locator)
            if property_value.locator in wrapper.properties
        ]

        return results

    def get_entity_by_selector(
        self, selector: str, /, *, by: opts.Selectors
    ) -> EntityWrapperVariant:
        match by:
            case opts.Selectors.NAME:
                for wrapper in self.modelEntities.values():
                    if wrapper.entity.name == selector:
                        return wrapper
                raise errors.EntityNotFoundError(selector)
            case opts.Selectors.ID:
                try:
                    id = int(selector)
                except ValueError as err:
                    raise utils.create_error(
                        ValueError(f"Model ID '{selector}' is not a valid number")
                    ) from err
                return self.get_model_entity_by_id(id)
            case opts.Selectors.LOCATOR:
                return self.get_entity_by_locator(selector)
            case _:
                raise NotImplementedError(f"by {by}")

    def get_all_entities(self) -> list[EntityWrapperVariant]:
        return [wrapper for wrapper in self.get_entity_iterator()]

    def get_entities(self, search_locator: str | Locator, /) -> list[EntityWrapperVariant]:
        """
        Retrieve a list of EntityWrappers that are hierarchically underneath the
        given locator.

        Parameters
        ----------
        search_locator : `str` or `Locator`
            The parent locator to search for entities.

        Returns
        -------
        `list[EntityWrapper]`
            Since the entityType is not known beforehand type hints for the
            entities are not available automatically and need to be added manually.
        """
        search_locator = _ensure_locator(search_locator)

        if search_locator == ROOT_LOCATOR:
            return self.get_all_entities()

        child_locators = self.get_child_locators(search_locator)

        if len(child_locators) == 0:
            return []

        entity_dict: dict[Locator, EntityWrapperVariant] = getattr(self, search_locator.entityType)
        entities = [
            entity_dict[_loc]
            if entity_dict[_loc].resolved
            else self.resolve_wrapper(entity_dict[_loc])
            for _loc in child_locators
        ]

        return entities

    def get_child_locators(self, search_locator: str | Locator, /) -> list[Locator]:
        """
        Retrieve all enties located underneath the given locator, works for alle
        items not only model entities.

        Only locators to actual entities are return, no "intermediate" locators point to folders.

        Parameters
        ----------
        search_locator : `str` or `Locator`
            The locator used for searching. It itself is not included in the results.

        Returns
        -------
        `list[Locator]`
            Since the entityType is not known beforehand type hints for the
            entities are not available automatically and need to be added manually.
        """
        search_locator = _ensure_locator(search_locator)
        locators_to_be_compared: list[Locator] = [
            _loc for _loc in getattr(self, search_locator.entityType)
        ]
        found_locators = list(filter(lambda _loc: _loc in search_locator, locators_to_be_compared))

        return found_locators

    def save(self, locator: str | None = None, /) -> None:
        """
        Saves the current state of the model or a specific entity to the corresponding json file.
        """
        changed_wrappers = [w for w in self.get_entities(locator or "/") if w.has_changed]
        deleted_wrappers = [w for w in self.get_entities(locator or "/") if w.is_deleted]

        no_of_changes = len(changed_wrappers)
        no_of_deletions = len(deleted_wrappers)

        if no_of_changes == 0 and no_of_deletions == 0:
            logger.info("Nothing has changed")
            return

        # group change entities by file to minimize disk operations
        file_to_wrappers: dict[Path, dict[str, list[EntityWrapperVariant]]] = {}

        for _p, file_ref in self._model_files.items():
            to_be_saved = {
                "changed": [w for w in changed_wrappers if w.locator in file_ref.locators],
                "deleted": [w for w in deleted_wrappers if w.locator in file_ref.locators],
            }
            if len(to_be_saved["deleted"]) == 0 and len(to_be_saved["changed"]) == 0:
                continue

            file_to_wrappers[_p] = to_be_saved

        logger.info(
            "Saving %s changed files, with %s changed entities and %s deleted entities",
            len(file_to_wrappers.keys()),
            no_of_changes,
            no_of_deletions,
        )

        for _file in file_to_wrappers:
            logger.debug(f"Saving to {_file}")

            if _file.exists():
                self._model_files[_file].update(wrappers=file_to_wrappers[_file]["changed"])
                self._model_files[_file].delete(wrappers=file_to_wrappers[_file]["deleted"])
            else:
                self._model_files[_file].create(wrappers=file_to_wrappers[_file]["changed"])

            # reset _changed attribute for saved entities
            for wrapper in file_to_wrappers[_file]["changed"]:
                wrapper._changed = False

            for wrapper in file_to_wrappers[_file]["deleted"]:
                del getattr(self, wrapper.locator.entityType)[wrapper.locator]

        # remove file refs if there are no more locators associated with them

        self.cleanup_entity_file_references()

        for wrapper in deleted_wrappers:
            if wrapper.locator.entityType == b.EntityType.FOLDERS.value and wrapper.locator.entityName:
                self.cleanup_directories(
                    Path(
                        config.solution_folder_path / self.solution.basePath,
                        *wrapper.locator.folders,
                        wrapper.locator.entityName,
                    ),
                    Path(
                        config.solution_folder_path / self.solution.modelPath,
                        *wrapper.locator.folders,
                        wrapper.locator.entityName,
                    ),
                )

    def cleanup_entity_file_references(self) -> None:
        deleted_files: list[Path] = []

        for file_ref in self._model_files:
            if len(self._model_files[file_ref].locators) == 0:
                deleted_files.append(file_ref)

        for _file in deleted_files:
            del self._model_files[_file]

    def cleanup_directories(self, *start_paths: Path) -> None:
        for start_path in start_paths:
            if not start_path.exists() or not start_path.is_dir():
                continue

            for dir_path, _, _ in start_path.walk(top_down=False):
                if dir_path.exists() and not any(dir_path.iterdir()):
                    utils.delete_path(dir_path)

            if start_path.exists() and not any(start_path.iterdir()):
                utils.delete_path(start_path)

    def get_unsaved_entities(self) -> tuple[list[Locator], list[Locator]]:
        """Returns a list of changed and delete locators"""
        changed = [wrapper.locator for wrapper in self.get_entity_iterator() if wrapper.has_changed]
        deleted = [wrapper.locator for wrapper in self.get_entity_iterator() if wrapper.is_deleted]
        return changed, deleted


class EntityFileRef:
    def __init__(
        self, /, _type: b.EntityType, file_path: Path, locators: list[Locator] | None = None
    ) -> None:
        self._type: b.EntityType = _type
        self.file_path: Path = file_path
        self.locators: list[Locator] = locators or []

    def __repr__(self) -> str:
        return f"EntityFileRef({self._type} file={self.file_path})"

    def create(self, *, wrappers: list[EntityWrapperVariant]) -> None:
        logger.debug(f"Trying to create {self.file_path} with %s entities ", len(wrappers))

        if len(wrappers) == 0:
            return

        entities = [wrapper.entity for wrapper in wrappers]
        _model = None

        match self._type:
            case b.EntityType.MODEL_ENTITIES:
                # model entities are special, since those files only contain a single entry
                if len(entities) != 1:
                    raise utils.create_error(
                        Exception(
                            "Only one wrapper to update allowed when updateing single model file"
                        )
                    )
                _model = entities[0]
            case b.EntityType.FOLDERS:
                _class = b.Folders
            case b.EntityType.PROPERTIES:
                _class = b.Properties
            case b.EntityType.PROPERTY_VALUES:
                _class = b.PropertyValues
            case b.EntityType.ZONES:
                _class = b.Zones
            case b.EntityType.DATA_TYPES:
                _class = b.DataTypes
            case b.EntityType.DATA_SOURCE_TYPES:
                _class = b.DataSourceTypes
            case b.EntityType.DATA_PRODUCTS:
                _class = b.DataProducts
            case b.EntityType.DATA_MODULES:
                _class = b.DataModules
            case b.EntityType.ATTRIBUTE_TYPES:
                _class = b.AttributeTypes
            case b.EntityType.DATA_SOURCES:
                _class = b.DataSources
            case _:
                raise utils.create_error(NotImplementedError(self._type.value))

        # one of both is always defined
        _model = _model or _class.from_dict(  # pyright: ignore [reportPossiblyUnboundVariable]
            {"type": self._type.value, self._type.value: entities},
        )

        utils.mkdir(self.file_path.parent, recursive=True)
        _model.to_json_file(self.file_path, "x", MODEL_DUMP_OPTIONS)

    def delete(self, *, wrappers: list[EntityWrapperVariant]) -> bool:
        """
        Raises
        ------
        FileNotFoundError
            If the file to be updated does not exist
        """
        if len(wrappers) == 0:
            return False

        logger.debug(f"Trying to delete %s entities from {self.file_path}", len(wrappers))

        match self._type:
            case b.EntityType.MODEL_ENTITIES:
                if len(wrappers) > 1:
                    raise utils.create_error(
                        "Only one wrapper to update allowed when updateing single model file"
                    )
                utils.delete_path(self.file_path)
                self.locators = []
                return True
            case b.EntityType.FOLDERS:
                wrapper_locators = [w.locator for w in wrappers]
                remaining_locators = [
                    loc for loc in self.locators if loc not in wrapper_locators
                ]

                if len(remaining_locators) == 0:
                    utils.delete_path(self.file_path)
                    self.locators = []
                    return True

                current_content = b.BaseEntities.from_json_file(self.file_path)
                entities: list[b.BaseEntityType] = getattr(
                    current_content.root, self._type.value
                )
                remaining_names = {
                    loc.entityName for loc in remaining_locators if loc.entityName
                }
                entities = [e for e in entities if e.name in remaining_names]

                if len(entities) == 0:
                    utils.delete_path(self.file_path)
                    self.locators = []
                    return True

                setattr(current_content.root, self._type.value, entities)
                with open(self.file_path, "w", encoding="utf-8") as _file:
                    _file.write(current_content.model_dump_json(**MODEL_DUMP_OPTIONS))

                self.locators = remaining_locators
                return False

            case _:
                current_content = b.BaseEntities.from_json_file(self.file_path)
                entities: list[b.BaseEntityType] = getattr(current_content.root, self._type.value)

                wrapper_names = [w.entity.name for w in wrappers]
                entities = [e for e in entities if e.name not in wrapper_names]

                remaining_locators = [
                    loc for loc in self.locators if loc not in [w.locator for w in wrappers]
                ]

                if len(entities) == 0:
                    utils.delete_path(self.file_path)
                    self.locators = []
                    return True

                setattr(current_content.root, self._type.value, entities)

                with open(self.file_path, "w", encoding="utf-8") as _file:
                    _file.write(current_content.model_dump_json(**MODEL_DUMP_OPTIONS))

                self.locators = remaining_locators

                # NOTE: this should actually never not be case, if not then something went majorly wrong
                assert len(self.locators) == len(entities)

                return False

    def update(self, *, wrappers: list[EntityWrapperVariant]) -> None:
        """
        Raises
        ------
        FileNotFoundError
            If the file to be updated does not exist
        """
        if len(wrappers) == 0:
            return

        logger.debug(f"Trying to update {self.file_path} with %s entities", len(wrappers))

        match self._type:
            case b.EntityType.MODEL_ENTITIES:
                current_content = m.ModelEntity.from_json_file(self.file_path)
                if len(wrappers) > 1:
                    utils.create_error(
                        "Only one wrapper to update allowed when updateing single model file"
                    )
                current_content = cast(m.ModelEntity, wrappers[0].entity)
            case _:
                current_content = b.BaseEntities.from_json_file(self.file_path)
                entities: b.BaseEntityType = getattr(current_content.root, self._type.value)

                for wrapper in wrappers:
                    replaced = False
                    for existing_idx, existing_entity in enumerate(entities):
                        if existing_entity.name == wrapper.entity.name:
                            entities[existing_idx] = wrapper.entity
                            replaced = True
                            break
                    if not replaced:
                        entities.append(wrapper.entity)

                setattr(current_content.root, self._type.value, entities)

        current_content.to_json_file(self.file_path, "w", MODEL_DUMP_OPTIONS)

        logger.info("Saved %s entities to %s", len(wrappers), self.file_path)

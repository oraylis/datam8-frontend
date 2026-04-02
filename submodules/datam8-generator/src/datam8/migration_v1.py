import dataclasses
import datetime
import logging
import pathlib
import shutil
from collections.abc import Sequence
from typing import Any, overload

from datam8 import parser_v1, utils
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
from datam8_model.v1 import AttributeTypes as at_legacy
from datam8_model.v1 import CoreModelEntry as core_legacy
from datam8_model.v1 import CuratedModelEntry as curated_legacy
from datam8_model.v1 import DataProducts as dp_legacy
from datam8_model.v1 import DataSources as ds_legacy
from datam8_model.v1 import DataTypes as dt_legacy
from datam8_model.v1 import RawModelEntry as raw_legacy
from datam8_model.v1 import Solution
from datam8_model.v1 import StageModelEntry as stage_legacy

logger = logging.getLogger(__name__)

MODEL_DUMP_OPTIONS: dict[str, Any] = {
    "indent": 2,
    "exclude_defaults": True,
    "exclude_none": True,
}

type BaseEntitiesType = ds_legacy.Model | at_legacy.Model | dp_legacy.Model | dt_legacy.Model

type Tags = Sequence[str]


def data_source(old: ds_legacy.DataSource) -> ds.DataSource:
    if old.name is None or old.type is None:
        raise MigrationError("name|type")

    if old.dataTypeMapping is None:
        new_mapping = []
    else:
        new_mapping = [data_type_mapping(dtm) for dtm in old.dataTypeMapping]

    new = ds.DataSource(
        name=old.name,
        type=old.type,
        displayName=old.displayName,
        description=old.purpose,
        dataTypeMapping=new_mapping,
        extendedProperties=getattr(old, "ExtendedProperties", {}),
    )

    return new


def data_type_mapping(
    old: ds_legacy.DataTypeMappingItem,
) -> ds.SourceDataTypeMapping:
    if old.sourceType is None or old.targetType is None:
        raise MigrationError("sourceType|targetType")

    new = ds.SourceDataTypeMapping(
        sourceType=old.sourceType,
        targetType=old.targetType,
    )

    return new


def attribute_type(old: at_legacy.AttributeType) -> a.AttributeType:
    if old.isUnit == at_legacy.IsUnit.CURRENCY or old.hasUnit == at_legacy.HasUnit.CURRENCY:
        has_unit = a.HasUnit.CURRENCY
    elif old.isUnit == at_legacy.IsUnit.PHYSICAL or old.hasUnit == at_legacy.IsUnit.PHYSICAL:
        has_unit = a.HasUnit.PHYSICAL
    else:
        has_unit = a.HasUnit.NO_UNIT

    new = a.AttributeType(
        name=old.name,
        displayName=old.displayName,
        description=_compose_description(old.purpose, old.explanation),
        defaultType=old.defaultType,
        defaultLength=old.defaultLength,
        defaultPrecision=old.defaultPrecision,
        defaultScale=old.defaultScale,
        hasUnit=has_unit,
        canBeInRelation=old.canBeInRelation,
        isDefaultProperty=old.isDefaultProperty,
    )

    return new


def data_module(old: dp_legacy.DataModule) -> dp.DataModule:
    if old.name is None:
        raise MigrationError("name")

    new = dp.DataModule(
        name=old.name,
        displayName=old.displayName,
        description=_compose_description(old.purpose, old.explanation),
    )

    return new


def data_product(old: dp_legacy.DataProduct) -> dp.DataProduct:
    if old.module is None or old.name is None:
        raise MigrationError("module|name")

    new = dp.DataProduct(
        name=old.name,
        displayName=old.displayName,
        dataModules=[data_module(dm) for dm in old.module],
        description=_compose_description(old.purpose, old.explanation),
    )

    return new


def _compose_description(purpose: str | None, explanation: str | None) -> str | None:
    if purpose and explanation:
        return f"{purpose}\n{explanation}"
    elif purpose is None:
        return explanation
    elif explanation is None:
        return purpose

    return None


def data_type(old: dt_legacy.DataType) -> dt.DataTypeDefinition:
    targets = {
        "databricks": old.parquetType,
        "sqlserver": old.sqlType,
    }

    new = dt.DataTypeDefinition(
        name=old.name,
        displayName=old.displayName,
        description=_compose_description(old.purpose, None),
        hasCharLen=old.hasCharLen,
        hasPrecision=old.hasPrecision,
        hasScale=old.hasScale,
        targets=targets,
    )

    return new


@overload
def base_entities(old: at_legacy.Model) -> b.AttributeTypes: ...
@overload
def base_entities(old: ds_legacy.Model) -> b.DataSources: ...
@overload
def base_entities(old: dp_legacy.Model) -> b.DataProducts: ...
@overload
def base_entities(old: dt_legacy.Model) -> b.DataTypes: ...


def base_entities(old: BaseEntitiesType) -> b.BaseEntitiesType:
    if old.items is None:
        raise MigrationError("items")

    match old:
        case at_legacy.Model():
            return b.AttributeTypes(
                type=b.EntityType.ATTRIBUTE_TYPES.value,
                attributeTypes=[attribute_type(at) for at in old.items],
            )
        case ds_legacy.Model():
            return b.DataSources(
                type=b.EntityType.DATA_SOURCES.value,
                dataSources=[data_source(ds) for ds in old.items],
            )
        case dp_legacy.Model():
            return b.DataProducts(
                type=b.EntityType.DATA_PRODUCTS.value,
                dataProducts=[data_product(dp) for dp in old.items],
            )
        case dt_legacy.Model():
            return b.DataTypes(
                type=b.EntityType.DATA_TYPES.value,
                dataTypes=[data_type(dt) for dt in old.items],
            )


def get_dm8l_core_source(
    sources: Sequence[core_legacy.SourceEntity] | None,
) -> dict[str, core_legacy.MappingItem]:
    attributes: dict[str, core_legacy.MappingItem] = {}

    for src in sources or []:
        if src.dm8l == "#":
            for attr in src.mapping or []:
                if attr.name is None:
                    raise MigrationError("name")

                attributes[attr.name] = attr
            break

    return attributes


def attribute(old: core_legacy.Attribute | stage_legacy.Attribute) -> a.Attribute:
    match old:
        case core_legacy.Attribute():
            return attribute_core(old)
        case stage_legacy.Attribute():
            return attribute_stage(old)


def attribute_stage(old: stage_legacy.Attribute) -> a.Attribute:
    is_pk = "BK" in (old.tags or [])

    new = a.Attribute(
        ordinalNumber=1,
        name=old.name,
        dataType=dt.DataType(
            type=old.type,
            nullable=old.nullable or False,
            charLen=utils.none_if(old.charLength, 0),
            precision=old.precision,
            scale=old.scale,
        ),
        attributeType="Source",
        dateAdded=datetime.datetime.now(datetime.UTC),
        dateDeleted=None,
        dateModified=None,
        properties=[
            p.PropertyReference(property="tags", value=t) for t in old.tags or [] if t not in ["BK"]
        ],
        isBusinessKey=is_pk,
        history=a.HistoryType.SCD0 if is_pk else a.HistoryType.SCD1,
    )

    return new


def attribute_core(old: core_legacy.Attribute) -> a.Attribute:
    if old.dataType is None or old.attributeType is None:
        raise MigrationError("dataType|attributeType")

    history: a.HistoryType = a.HistoryType.SCD0
    old_history = old.history or core_legacy.History.SCD1

    if old_history.value in a.HistoryType._value2member_map_:
        history = a.HistoryType(old_history.value)

    properties = [p.PropertyReference(property="tags", value=tag) for tag in old.tags or []]

    if old.history == core_legacy.History.SK:
        properties.append(p.PropertyReference(property="column_type", value="SK"))

    new = a.Attribute(
        name=old.name,
        displayName=old.displayName,
        description=_compose_description(old.purpose, old.explanation),
        ordinalNumber=1,
        attributeType=old.attributeType,
        isBusinessKey=True if old.businessKeyNo else False,
        properties=properties if properties else None,
        history=history,
        dataType=dt.DataType(
            type=old.dataType,
            nullable=old.nullable or False,
            charLen=utils.none_if(old.charLength, 0),
            precision=old.precision,
            scale=old.scale,
        ),
        dateAdded=datetime.datetime.now(datetime.UTC),
        dateDeleted=None,
        dateModified=None,
        refactorNames=old.refactorNames if old.refactorNames else None,
    )

    return new


class MigrationV1:
    def __init__(self, model_file_references: dict[str, parser_v1.ModelFileReference]):
        self.model_file_references = model_file_references

    @overload
    def model_entities(self, old: raw_legacy.Model) -> m.ModelEntity: ...
    @overload
    def model_entities(self, old: stage_legacy.Model) -> m.ModelEntity: ...
    @overload
    def model_entities(self, old: core_legacy.Model) -> m.ModelEntity: ...
    @overload
    def model_entities(self, old: curated_legacy.Model) -> m.ModelEntity: ...

    def model_entities(self, old: parser_v1.ModelEntitiesType) -> m.ModelEntity:
        match old:
            case core_legacy.Model() | curated_legacy.Model():
                return self.core_entity(old)
            case stage_legacy.Model():
                return self.stage_entity(old)

        raise NotImplementedError()

    def stage_entity(self, old: stage_legacy.Model) -> m.ModelEntity:
        if old.entity is None or old.function is None:
            raise MigrationError("entity|function")

        if old.entity.attribute is None:
            raise MigrationError("entity.attribute")

        if old.function.dataSource is None or old.function.sourceLocation is None:
            raise MigrationError("function.dataSource|function.sourceLocation")

        stage_locator = f"/stage/{old.entity.dataProduct.lower()}/{old.entity.dataModule.lower()}/{old.entity.name.lower()}"
        raw_locator = old.function.sourceLocation.replace("raw", "/Raw")

        raw_entity = parser_v1.parse_model_file(
            self.model_file_references[raw_locator.lower()].path
        )
        if not isinstance(raw_entity, raw_legacy.Model):
            raise Exception("Stage needs to have a raw entity as a source")

        if (
            raw_entity.function is None
            or raw_entity.function.dataSource is None
            or raw_entity.entity is None
            or raw_entity.function.sourceLocation is None
        ):
            raise MigrationError("raw_entity.function")

        source_attributes: dict[str, raw_legacy.Attribute] = {
            attr.name: attr for attr in raw_entity.entity.attribute or []
        }
        source_attribute_mappings: dict[str, stage_legacy.AttributesMapping] = {
            sam.target: sam for sam in old.function.attributeMapping or []
        }

        new_source = m.ExternalModelSource(
            dataSource=raw_entity.function.dataSource,
            sourceLocation=raw_entity.function.sourceLocation,
            mapping=[
                m.SourceAttributeMapping(
                    sourceName=mapping.source,
                    targetName=mapping.target,
                    sourceDataType=dt.DataType(
                        type=source_attributes[mapping.source].type,
                        nullable=source_attributes[mapping.source].nullable or False,
                        charLen=utils.none_if(source_attributes[mapping.source].charLength, 0),
                        precision=source_attributes[mapping.source].precision,
                        scale=source_attributes[mapping.source].scale,
                    ),
                )
                for target, mapping in source_attribute_mappings.items()
            ],
        )

        attributes: list[a.Attribute] = []
        ordinal_number: int = 0

        for attr in old.entity.attribute:
            ordinal_number += 1
            new_attribute = attribute(attr)
            new_attribute.ordinalNumber = ordinal_number

            old_date_added = source_attributes[
                source_attribute_mappings[attr.name].source
            ].dateAdded
            old_date_modified = source_attributes[
                source_attribute_mappings[attr.name].source
            ].dateModified
            old_date_deleted = source_attributes[
                source_attribute_mappings[attr.name].source
            ].dateDeleted

            try:
                new_date_modified = timestamp(old_date_modified)
                new_date_added = timestamp(old_date_added)
                new_date_deleted = timestamp(old_date_deleted)
            except Exception as err:
                logger.error(
                    "Could not convert existing timestamp for %s:%s - %s (%s)",
                    stage_locator,
                    new_attribute.name,
                    old_date_modified,
                    str(err),
                )
                new_date_added = new_attribute.dateAdded
                new_date_modified = None
                new_date_deleted = None

            new_attribute.dateModified = new_date_modified
            new_attribute.dateAdded = new_date_added or new_date_modified or new_attribute.dateAdded
            new_attribute.dateDeleted = new_date_deleted

            attributes.append(new_attribute)

            # combine raw and stage parameter
        parameters = [
            m.ModelParameter(name=t.name, value=t.value) for t in raw_entity.entity.parameters or []
        ] + [
            m.ModelParameter(name=t.name, value=t.value)
            for t in old.entity.parameters or []
            if t.name not in (p.name for p in raw_entity.entity.parameters or [])
        ]

        properties = [
            p.PropertyReference(property="tags", value=tag) for tag in old.entity.tags or []
        ] + [
            p.PropertyReference(property="tags", value=tag)
            for tag in raw_entity.entity.tags or []
            if tag not in (old.entity.tags or [])
        ]

        new = m.ModelEntity(
            id=self.model_file_references[stage_locator].id,
            name=old.entity.name,
            displayName=old.entity.displayName,
            attributes=attributes,
            sources=[new_source],
            transformations=[],
            relationships=[],
            parameters=parameters,
            properties=properties,
        )

        return new

    def core_entity(self, old: core_legacy.Model | curated_legacy.Model) -> m.ModelEntity:
        if old.entity is None or old.function is None:
            raise MigrationError("entity|function")

        if old.entity.attribute is None:
            raise MigrationError("entity.attribute")

        match old:
            case core_legacy.Model():
                attribute_mappings = get_dm8l_core_source(old.function.source)
            case curated_legacy.Model():
                attribute_mappings: dict[str, Any] = {}

        attributes: list[a.Attribute] = []
        base_locator = f"{old.entity.dataProduct.lower()}/{old.entity.dataModule.lower()}/{old.entity.name.lower()}"
        source_mappings: list[m.InternalModelSource] = []
        transformations: list[m.ModelTransformation] = []
        ordinal_number = 0

        for attr in old.entity.attribute:
            ordinal_number += 1
            new_attribute = attribute(attr)
            new_attribute.ordinalNumber = ordinal_number
            # new_attribute.dateAdded = datetime.datetime.now()

            if attr.name in attribute_mappings:
                source_computation = attribute_mappings[attr.name].sourceComputation
                new_attribute.expression = (
                    source_computation if source_computation != "Default" else None
                )

            attributes.append(new_attribute)

        match old:
            case core_legacy.Model():
                locator = "/core/" + base_locator
                transformations.append(
                    m.ModelTransformation(
                        stepNo=1,
                        kind=m.TransformationKind.FUNCTION,
                        name="default (migrated)",
                        function=m.TransformationFunction(
                            source=f"{utils.pascal_to_snake_case(old.entity.name)}.py"
                        ),
                    )
                )
                for src in old.function.source or []:
                    if src.dm8l == "#":
                        continue

                    source_mapping = [
                        m.SourceAttributeMapping(
                            sourceName=mapping.sourceName,
                            targetName=mapping.name,
                        )
                        for mapping in src.mapping or []
                        if mapping.name is not None and mapping.name != mapping.sourceName
                    ]

                    new_source = m.InternalModelSource(
                        sourceLocation=self.model_file_references[src.dm8l.lower()].id,
                        mapping=source_mapping if len(source_mapping) > 0 else None,
                    )

                    source_mappings.append(new_source)
            case curated_legacy.Model():
                locator = "/curated/" + base_locator
                curStep = 1
                for func in old.function:
                    transformations.append(
                        m.ModelTransformation(
                            stepNo=curStep,
                            kind=m.TransformationKind.FUNCTION,
                            name=func.name,
                            function=m.TransformationFunction(
                                source=f"{utils.pascal_to_snake_case(old.entity.name)}.py"
                            ),
                        )
                    )
                    for src in func.source or []:
                        source_mappings.append(
                            m.InternalModelSource(
                                sourceLocation=self.model_file_references[src.dm8l.lower()].id
                            )
                        )

        relationships: list[m.ModelRelationship] = []
        for rel in old.entity.relationship or []:
            new_relationship = m.ModelRelationship(
                targetLocation=self.model_file_references[rel.dm8lKey.lower()].id,
                alias=rel.role if rel.role != "#" else None,
                attributes=[
                    m.ModelAttributeMapping(sourceName=attr.dm8lKeyAttr, targetName=attr.dm8lAttr)
                    for attr in rel.fields or []
                ],
            )
            relationships.append(new_relationship)

        new = m.ModelEntity(
            id=self.model_file_references[locator].id,
            name=old.entity.name,
            displayName=old.entity.displayName,
            description=_compose_description(old.entity.purpose, old.entity.explanation),
            parameters=[
                m.ModelParameter(name=p.name, value=p.value) for p in old.entity.parameters or []
            ],
            properties=[
                p.PropertyReference(property="tags", value=tag) for tag in old.entity.tags or []
            ],
            attributes=attributes,
            sources=source_mappings,
            transformations=transformations,
            relationships=relationships,
        )

        return new

    def migrate_model_entities(
        self, model_dir_path: pathlib.Path, output_path: pathlib.Path
    ) -> Tags:
        """
        Migrate tags from a directory and return all used tags
        """

        tags: list[str] = []

        for file in model_dir_path.glob("**/*.json"):
            output_file_path = (
                output_path / file.parent.relative_to(model_dir_path.absolute()) / file.name
            )

            logger.debug(f"Migrating {file} to {output_file_path}")

            model_entity = parser_v1.parse_model_file(file)
            content = self.model_entities(model_entity).model_dump_json(
                indent=2, exclude_none=True, exclude_defaults=True
            )

            utils.mkdir(output_file_path.parent, recursive=True)

            if model_entity.entity:
                tags.extend(model_entity.entity.tags or [])

            with open(output_file_path, "w") as _f:
                _f.write(content)

            python_file = file.with_suffix(".py")
            if python_file.exists():
                shutil.copy2(python_file, output_file_path.with_suffix(".py"))

        logger.info(
            f"Migrated model entities from {model_dir_path.as_posix()} to {output_path.as_posix()}"
        )

        return tags

    @staticmethod
    def migrate_base_entities(
        base_dir_path: pathlib.Path, output_path: pathlib.Path
    ) -> "NewBaseEntities":
        utils.mkdir(output_path, recursive=True)

        data_types, data_products, attribute_types, data_sources = [], [], [], []
        data_source_types: dict[str, ds.DataSourceType] = {}

        for file in base_dir_path.glob("*.json"):
            output_file_path = output_path / utils.pascal_to_snake_case(file.name)

            logger.debug(f"Migrating {file} to {output_file_path}")

            match file.name:
                case "DataTypes.json":
                    base_entity = dt_legacy.Model.from_json_file(file)
                case "DataProducts.json":
                    base_entity = dp_legacy.Model.from_json_file(file)
                case "AttributeTypes.json":
                    base_entity = at_legacy.Model.from_json_file(file)
                case "DataSources.json":
                    base_entity = ds_legacy.Model.from_json_file(file)
                case _:
                    logger.warning("Unknown base file found, cannot be migrated: %s", file.name)
                    continue

            new_base_entities = base_entities(base_entity)
            match new_base_entities:
                case b.DataTypes():
                    data_types = new_base_entities.dataTypes
                case b.DataProducts():
                    data_products = new_base_entities.dataProducts
                case b.AttributeTypes():
                    attribute_types = new_base_entities.attributeTypes
                case b.DataSources():
                    data_sources = new_base_entities.dataSources
                    for src in data_sources:
                        if src.type not in data_types:
                            data_source_types[src.type] = ds.DataSourceType(
                                name=src.type,
                                dataTypeMapping=[x for x in src.dataTypeMapping or []],
                                authModes=[],
                                connectionProperties=[
                                    ds.ConnectionProperty(
                                        name=x,
                                        required=False,
                                        type=ds.ConnectionPropertyValueType.STRING,
                                    )
                                    for x in src.extendedProperties
                                ],
                            )
                        src.dataTypeMapping = None

            content = new_base_entities.model_dump_json(indent=2, exclude_none=True)

            with open(output_file_path, "w") as file:
                file.write(content)

        with open(output_path / "data_source_types.json", "w") as _file:
            _file.write(
                b.DataSourceTypes(
                    type="dataSourceTypes",
                    dataSourceTypes=[x for x in data_source_types.values()],
                ).model_dump_json(**MODEL_DUMP_OPTIONS)
            )

        assert data_types is not None, "DataTypes were not found in solution"
        assert data_products is not None, "DataProducts were not found in solution"
        assert attribute_types is not None, "AttributeTypes were not found in solution"
        assert data_sources is not None, "DataSources were not found in solution"

        logger.info(
            f"Migrated base entities from {base_dir_path.as_posix()} to {output_path.as_posix()}"
        )

        return NewBaseEntities(
            data_types=data_types,
            data_products=data_products,
            attribute_types=attribute_types,
            data_sources=data_sources,
        )

    @staticmethod
    def migrate_zones(solution: Solution.Model, output_path: pathlib.Path) -> list[z.Zone]:
        new_zones = b.Zones(
            type="zones",
            zones=[
                z.Zone(
                    name="Stage",
                    displayName=solution.AreaTypes_1.Stage,
                    targetName="Stage",
                ),
                z.Zone(
                    name="Core",
                    displayName=solution.AreaTypes_1.Core,
                    targetName="Core",
                ),
                z.Zone(
                    name="Curated",
                    displayName=solution.AreaTypes_1.Curated,
                    targetName="Curated",
                ),
            ],
        )
        content = new_zones.model_dump_json(indent=2, exclude_defaults=True, exclude_none=True)

        with open(output_path, "w") as file:
            file.write(content)

        return [z for z in new_zones.zones]

    @staticmethod
    def create_new_databricks_solution(output_path: pathlib.Path) -> None:
        new_soution = s.Solution(
            schemaVersion="2.0.0",
            basePath=pathlib.Path("Base"),
            modelPath=pathlib.Path("Model"),
            pluginsPath=pathlib.Path("Plugins"),
            generatorTargets=[
                s.GeneratorTarget(
                    name="databricks",
                    sourcePath=pathlib.Path("Generate/databricks-lake"),
                    outputPath=pathlib.Path("Output"),
                    isDefault=True,
                )
            ],
        )
        content = new_soution.model_dump_json(**MODEL_DUMP_OPTIONS)

        with open(output_path, "w") as file:
            file.write(content)

    @staticmethod
    def create_new_properties(tags: Tags, output_path: pathlib.Path) -> None:
        new_properties = b.Properties(
            type="properties",
            properties=[
                p.Property(name="tags", displayName="Tags"),
                p.Property(name="column_type", displayName="Column Type"),
            ],
        )
        new_property_values = b.PropertyValues(
            type="propertyValues",
            propertyValues=[
                p.PropertyValue(
                    name=tag,
                    property="tags",
                )
                for tag in tags
            ],
        )

        with open(output_path / "properties.json", "w") as file:
            file.write(new_properties.model_dump_json(**MODEL_DUMP_OPTIONS))

        with open(output_path / "property_values.json", "w") as file:
            file.write(new_property_values.model_dump_json(**MODEL_DUMP_OPTIONS))

    @staticmethod
    def create_properties_for_folders(
        zones: Sequence[z.Zone],
        data_products: Sequence[dp.DataProduct],
        output_path: pathlib.Path,
    ) -> None:
        """Should only be called AFTER other models have been migrated. No new folders will be created."""
        next_id = 1

        for zone in zones:
            zone_path = output_path / zone.name
            if not zone_path.exists():
                continue

            for product in data_products:
                product_path = zone_path / product.name
                if not product_path.exists():
                    continue

                product_folder = b.Folders(
                    type="folders",
                    folders=[f.Folder(id=next_id, name=product.name, dataProduct=product.name)],
                )
                next_id += 1

                with open(product_path / ".properties.json", "w") as _file:
                    _file.write(product_folder.model_dump_json(**MODEL_DUMP_OPTIONS))

                for module in product.dataModules:
                    module_path = product_path / module.name
                    if not module_path.exists():
                        continue

                    module_folder = b.Folders(
                        type="folders",
                        folders=[
                            f.Folder(
                                id=next_id,
                                name=module.name,
                                dataProduct=product.name,
                                dataModule=module.name,
                            )
                        ],
                    )
                    next_id += 1

                    with open(module_path / ".properties.json", "w") as _file:
                        _file.write(module_folder.model_dump_json(**MODEL_DUMP_OPTIONS))


def timestamp(old: str | None) -> datetime.datetime | None:
    if old is None:
        return None
    err: Exception | None = None

    try:
        return datetime.datetime.fromisoformat(old).astimezone(datetime.UTC)
    except Exception as err_:
        err = err_
    try:
        return datetime.datetime.strptime(old, "%Y-%m-%d %H:%M:%S").astimezone(datetime.UTC)
    except Exception as err_:
        err = err_
    try:
        return datetime.datetime.strptime(old, "%Y-%M-%d %H:%m:%S").astimezone(datetime.UTC)
    except Exception as err_:
        err = err_

    raise err


class MigrationError(Exception):
    def __init__(self, attr: str):
        super().__init__(f"Attribute {attr} cannot be None")


@dataclasses.dataclass
class NewBaseEntities:
    data_types: Sequence[dt.DataTypeDefinition]
    data_products: Sequence[dp.DataProduct]
    attribute_types: Sequence[a.AttributeType]
    data_sources: Sequence[ds.DataSource]

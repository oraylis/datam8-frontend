# ruff: noqa: I001
import dataclasses
from datetime import datetime, UTC

from pytest_cases import parametrize

from datam8_model.v1 import (
    AttributeTypes as at_legacy,
    DataTypes as dt_legacy,
    DataProducts as dp_legacy,
    DataSources as ds_legacy,
    CoreModelEntry as core_legacy,
)
from datam8_model import (
    data_type as dt,
    attribute as at,
    base as b,
    data_product as dp,
    data_source as ds,
    model as m,
    property as p,  # noqa: F401
)
from datam8 import migration_v1, parser_v1
import pathlib

ref_date = datetime.now(UTC)


def load_core_files() -> list["ModelEntityMapping"]:
    file_before = pathlib.Path("./tests/test_040_migration/core_entity_before.json")
    file_after = pathlib.Path("./tests/test_040_migration/core_entity_after.json")

    model_before = core_legacy.Model.from_json_file(file_before)
    model_after = m.ModelEntity.from_json_file(file_after)

    mappings = [
        ModelEntityMapping(
            legacy=model_before,
            new=model_after,
        )
    ]

    return mappings


@dataclasses.dataclass
class BaseEntityMapping:
    legacy: migration_v1.BaseEntitiesType
    new: b.BaseEntitiesType


@dataclasses.dataclass
class ModelEntityMapping:
    legacy: parser_v1.ModelEntitiesType
    new: m.ModelEntity


class CaseBaseEntityMigration:
    @parametrize(
        "case",
        [
            BaseEntityMapping(
                legacy=dt_legacy.Model(
                    items=[
                        dt_legacy.DataType(
                            name="string",
                            displayName="Unicode String (UTF-8) with char length",
                            parquetType="string",
                            hasCharLen=True,
                            sqlType="nvarchar",
                        )
                    ]
                ),
                new=b.DataTypes(
                    type=b.EntityType.DATA_TYPES.value,
                    dataTypes=[
                        dt.DataTypeDefinition(
                            name="string",
                            displayName="Unicode String (UTF-8) with char length",
                            hasCharLen=True,
                            targets={
                                "databricks": "string",
                                "sqlserver": "nvarchar",
                            },
                        )
                    ],
                ),
            )
        ],
    )
    def case_entity_data_types_valid(self, case: BaseEntityMapping):
        return case

    @parametrize(
        "case",
        [
            BaseEntityMapping(
                legacy=dp_legacy.Model(
                    items=[
                        dp_legacy.DataProduct(
                            name="Sales",
                            displayName="All Entities for Sales.",
                            explanation="Test",
                            module=[
                                dp_legacy.DataModule(name="Customer", displayName="Customer module")
                            ],
                        )
                    ]
                ),
                new=b.DataProducts(
                    type=b.EntityType.DATA_PRODUCTS.value,
                    dataProducts=[
                        dp.DataProduct(
                            name="Sales",
                            displayName="All Entities for Sales.",
                            description="Test",
                            dataModules=[
                                dp.DataModule(name="Customer", displayName="Customer module"),
                            ],
                        )
                    ],
                ),
            )
        ],
    )
    def case_entity_data_products_valid(self, case: BaseEntityMapping):
        return case

    @parametrize(
        "case",
        [
            BaseEntityMapping(
                legacy=at_legacy.Model(
                    items=[
                        at_legacy.AttributeType(
                            name="Amt",
                            displayName="Amount",
                            purpose="Amount value having a currency",
                            defaultType="double",
                            hasUnit=at_legacy.HasUnit.CURRENCY,
                            isUnit=at_legacy.IsUnit.NO_UNIT,
                            canBeInRelation=False,
                            isDefaultProperty=False,
                        ),
                    ],
                ),
                new=b.AttributeTypes(
                    type=b.EntityType.ATTRIBUTE_TYPES.value,
                    attributeTypes=[
                        at.AttributeType(
                            name="Amt",
                            displayName="Amount",
                            description="Amount value having a currency",
                            defaultType="double",
                            hasUnit=at.HasUnit.CURRENCY,
                            canBeInRelation=False,
                            isDefaultProperty=False,
                        ),
                    ],
                ),
            )
        ],
    )
    def case_entity_attribute_types_valid(self, case: BaseEntityMapping):
        return case

    @parametrize(
        "case",
        [
            BaseEntityMapping(
                legacy=ds_legacy.Model(
                    items=[
                        ds_legacy.DataSource(
                            name="test",
                            type="sql",
                            dataTypeMapping=[
                                ds_legacy.DataTypeMappingItem(
                                    sourceType="string",
                                    targetType="string",
                                )
                            ],
                        )
                    ]
                ),
                new=b.DataSources(
                    type=b.EntityType.DATA_SOURCES.value,
                    dataSources=[
                        ds.DataSource(
                            name="test",
                            type="sql",
                            extendedProperties={},
                            dataTypeMapping=[
                                ds.SourceDataTypeMapping(
                                    sourceType="string",
                                    targetType="string",
                                )
                            ],
                        )
                    ],
                ),
            )
        ],
    )
    def case_entity_data_sources_valid(self, case: BaseEntityMapping):
        return case


class CaseModelEntityMigration:
    @parametrize("case", load_core_files())
    def case_entity_core_valid(self, case: ModelEntityMapping):
        return case

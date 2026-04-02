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
import io
import os
import shutil
import zipfile
from pathlib import Path

import requests

from datam8 import config, model, utils
from datam8_model import solution as s

SAMPLE_SOLUTION_VERSION = "2.0.0-beta.1"
SAMPLE_SOLUTION_REPO_URL = "https://github.com/oraylis/datam8-sample-solution"


DEFAULT_ATTRIBUTE_TYPES_JSON = """{
    "type": "attributeTypes",
    "attributeTypes": [
        {
            "name": "Amt",
            "displayName": "Amount",
            "description": "Amount value having a currency",
            "defaultType": "double",
            "hasUnit": "Currency"
        },
        {
            "name": "BirthDate",
            "displayName": "Birth Date of a Person",
            "defaultType": "datetime"
        },
        {
            "name": "CreationDate",
            "displayName": "Creation Date",
            "defaultType": "datetime",
            "hasUnit": "NoUnit"
        },
        {
            "name": "Currency",
            "displayName": "Currency Attribute",
            "defaultType": "string",
            "defaultLength": 3,
            "hasUnit": "NoUnit"
        },
        {
            "name": "Dsc",
            "displayName": "Description",
            "defaultType": "string",
            "defaultLength": 256,
            "hasUnit": "NoUnit"
        },
        {
            "name": "EMail",
            "displayName": "E-Mail Address",
            "defaultType": "string"
        },
        {
            "name": "Flag",
            "displayName": "Flag",
            "defaultType": "string",
            "defaultLength": 1
        },
        {
            "name": "ID",
            "displayName": "ID",
            "defaultType": "int",
            "canBeInRelation": true,
            "isDefaultProperty": false
        },
        {
            "name": "Key",
            "displayName": "Key",
            "defaultType": "string",
            "defaultLength": 16
        },
        {
            "name": "Name",
            "displayName": "Name",
            "defaultType": "string"
        },
        {
            "name": "PersonalInfo",
            "displayName": "Personal Information",
            "defaultType": "string",
            "defaultLength": 256
        },
        {
            "name": "SID",
            "displayName": "SID",
            "description": "Identity Type for SCD2 Entities",
            "defaultType": "int",
            "canBeInRelation": true,
            "isDefaultProperty": false
        },
        {
            "name": "Text",
            "displayName": "Text",
            "defaultType": "string"
        },
        {
            "name": "Unit",
            "displayName": "Unit",
            "description": "Unit for amount quanities",
            "defaultType": "string",
            "defaultLength": 16,
            "hasUnit": "NoUnit"
        },
        {
            "name": "Val",
            "displayName": "Value",
            "description": "Unit free value",
            "defaultType": "double",
            "hasUnit": "NoUnit"
        },
        {
            "name": "Generic String",
            "displayName": "Generic for String",
            "defaultType": "string",
            "isDefaultProperty": true
        },
        {
            "name": "Generic Datetime",
            "displayName": "Generic for Datetime",
            "defaultType": "datetime",
            "isDefaultProperty": true
        },
        {
            "name": "Generic Date",
            "displayName": "Generic for Date",
            "defaultType": "date",
            "isDefaultProperty": true
        },
        {
            "name": "Generic Int",
            "displayName": "Generic for Int",
            "defaultType": "int",
            "canBeInRelation": true,
            "isDefaultProperty": true
        },
        {
            "name": "Generic Double",
            "displayName": "Generic for Double",
            "defaultType": "double",
            "isDefaultProperty": true
        }
    ]
}
"""

DEFAULT_DATA_TYPES_JSON = """{
  "type": "dataTypes",
  "dataTypes": [
    {
      "name": "string",
      "displayName": "Unicode String (UTF-8) with char length",
      "description": "#",
      "hasCharLen": true,
      "targets": {
        "databricks": "string",
        "powerbi": "string"
      }
    },
    {
      "name": "short",
      "displayName": "Integer (16 bit)",
      "hasCharLen": false,
      "targets": {
        "databricks": "smallint",
        "powerbi": "int64"
      }
    },
    {
      "name": "int",
      "displayName": "Integer (32 bit)",
      "hasCharLen": false,
      "targets": {
        "databricks": "int",
        "powerbi": "int64"
      }
    },
    {
      "name": "long",
      "displayName": "Integer (64 bit)",
      "hasCharLen": false,
      "targets": {
        "databricks": "bigint",
        "powerbi": "int64"
      }
    },
    {
      "name": "byte",
      "displayName": "Integer (8 bit)",
      "hasCharLen": false,
      "targets": {
        "databricks": "tinyint",
        "powerbi": "int64"
      }
    },
    {
      "name": "double",
      "displayName": "Floating point with double precision",
      "description": "Test 2",
      "hasCharLen": false,
      "targets": {
        "databricks": "double",
        "powerbi": "double"
      }
    },
    {
      "name": "bit",
      "displayName": "Bit (1 bit)",
      "hasCharLen": false,
      "targets": {
        "databricks": "boolean",
        "powerbi": "boolean"
      }
    },
    {
      "name": "date",
      "displayName": "Date storage yyyy-mm-dd",
      "hasCharLen": false,
      "targets": {
        "databricks": "date",
        "powerbi": "date"
      }
    },
    {
      "name": "datetime",
      "displayName": "Date time storage yyyy-mm-dd HH:mm:ss",
      "hasCharLen": false,
      "targets": {
        "databricks": "timestamp",
        "powerbi": "timestamp"
      }
    },
    {
      "name": "binary",
      "displayName": "Binary storage",
      "hasCharLen": true,
      "targets": {
        "databricks": "binary",
        "powerbi": "binary"
      }
    },
    {
      "name": "uniqueidentifier",
      "displayName": "Unique Identifier",
      "hasCharLen": false,
      "targets": {
        "databricks": "string",
        "powerbi": "string"
      }
    },
    {
      "name": "decimal",
      "displayName": "Decimal",
      "hasCharLen": false,
      "hasPrecision": true,
      "hasScale": true,
      "targets": {
        "databricks": "decimal",
        "powerbi": "decimal"
      }
    },
    {
      "name": "money",
      "displayName": "Money",
      "hasCharLen": false,
      "targets": {
        "databricks": "decimal(19,4)",
        "powerbi": "decimal"
      }
    },
    {
      "name": "dynstring",
      "displayName": "string without character lenght",
      "hasCharLen": false,
      "targets": {
        "databricks": "string",
        "powerbi": "string"
      }
    },
    {
      "name": "dyndecimal",
      "displayName": "decimal with precision and scale",
      "hasCharLen": false,
      "targets": {
        "databricks": "decimal(19,3)",
        "powerbi": "decimal"
      }
    }
  ]
}
"""

DEFAULT_PROPERTIES_JSON = """{
  "type": "properties",
  "properties": [
    {
      "name": "jobs",
      "displayName": "jobs",
      "scopes": [
        {
          "type": "entity",
          "singleUsage": false
        }
      ]
    },
    {
      "name": "schedules",
      "displayName": "schedules",
      "scopes": [
        {
          "type": "none"
        }
      ]
    },
    {
      "name": "cluster",
      "displayName": "cluster",
      "scopes": [
        {
          "type": "none"
        }
      ]
    },
    {
      "name": "tags",
      "displayName": "tags",
      "scopes": []
    },
    {
      "name": "write_mode",
      "displayName": "write mode",
      "scopes": [
        {
          "type": "entity",
          "mandatory": true
        }
      ]
    },
    {
      "name": "data_retention",
      "displayName": "data retention",
      "scopes": [
        {
          "type": "entity"
        }
      ]
    },
    {
      "name": "business_area",
      "displayName": "Business Area",
      "scopes": [
        {
          "type": "folder"
        }
      ]
    },
    {
      "name": "target",
      "displayName": "Target",
      "scopes": [
        {
          "type": "zone"
        }
      ]
    }
  ]
}
"""

DEFAULT_PROPERTY_VALUES_JSON = """{
  "type": "propertyValues",
  "propertyValues": [
    {
      "name": "merge",
      "displayName": "merge",
      "default": true,
      "property": "write_mode"
    },
    {
      "name": "overwrite",
      "displayName": "overwrite",
      "property": "write_mode"
    },
    {
      "name": "delta",
      "displayName": "Delta",
      "property": "extract_column"
    },
    {
      "name": "delta",
      "displayName": "Delta",
      "property": "extract_mode"
    },
    {
      "name": "query",
      "displayName": "Query",
      "property": "extract_mode"
    },
    {
      "name": "daily",
      "displayName": "Daily",
      "default": true,
      "property": "schedules",
      "cron": "1 0"
    },
    {
      "name": "weekly",
      "displayName": "Weekly",
      "property": "schedules",
      "cron": "1 0"
    },
    {
      "name": "small",
      "displayName": "S",
      "property": "cluster",
      "node_type": "Standard_D4ds_v5",
      "num_workers": 4,
      "workload_type": "job"
    },
    {
      "name": "extra_small",
      "displayName": "XY",
      "default": true,
      "property": "cluster",
      "node_type": "Standard_D4ds_v5",
      "num_workers": 2,
      "workload_type": "job"
    },
    {
      "name": "sales_daily",
      "displayName": "Sales (Daily)",
      "property": "jobs",
      "properties": [
        {
          "property": "schedules",
          "value": "daily"
        },
        {
          "property": "cluster",
          "value": "small"
        }
      ]
    },
    {
      "name": "sales_weekly",
      "displayName": "Sales (Weekly)",
      "property": "jobs",
      "properties": [
        {
          "property": "schedules",
          "value": "weekly"
        },
        {
          "property": "cluster",
          "value": "extra_small"
        }
      ]
    },
    {
      "name": "sales",
      "displayName": "Sales",
      "property": "business_area"
    },
    {
      "name": "true",
      "displayName": "Has TypeWidening",
      "property": "enable_type_widening"
    },
    {
      "name": "name",
      "displayName": "Name Column Mapping",
      "property": "column_mapping_mode"
    },
    {
      "name": "7_days",
      "displayName": "7 Days Data Retention",
      "property": "data_retention"
    }
  ]
}
"""

DEFAULT_ZONES_JSON = """{
  "type": "zones",
  "zones": [
    {
      "name": "Zone1",
      "targetName": "zone1",
      "displayName": "Zone1"
    }
  ]
}
"""

DEFAULT_DATA_SOURCES_JSON = """{
  "type": "dataSources",
  "dataSources": [
    {
      "name": "DataSource1",
      "type": "DataSourceType1",
      "extendedProperties": {}
    }
  ]
}
"""

DEFAULT_DATA_SOURCE_TYPES_JSON = """{
  "type": "dataSourceTypes",
  "dataSourceTypes": [
    {
      "name": "DataSourceType1",
      "dataTypeMapping": [
        {
          "sourceType": "string",
          "targetType": "string"
        }
      ],
      "connectionProperties": [
        {
          "name": "host",
          "required": true,
          "type": "string"
        }
      ],
      "authModes": [
        {
          "name": "default",
          "required": [
            "host"
          ],
          "optional": []
        }
      ]
    }
  ]
}
"""

DEFAULT_DATA_PRODUCTS_JSON = """{
  "type": "dataProducts",
  "dataProducts": [
    {
      "name": "DataProduct1",
      "dataModules": [
        {
          "name": "Module1",
          "displayName": "Module1",
          "properties": []
        }
      ]
    }
  ]
}
"""

def _write_default_base_entities(base_path: Path) -> None:
    files = {
        "AttributeTypes.json": DEFAULT_ATTRIBUTE_TYPES_JSON,
        "DataTypes.json": DEFAULT_DATA_TYPES_JSON,
        "Properties.json": DEFAULT_PROPERTIES_JSON,
        "PropertyValues.json": DEFAULT_PROPERTY_VALUES_JSON,
        "Zones.json": DEFAULT_ZONES_JSON,
        "DataSources.json": DEFAULT_DATA_SOURCES_JSON,
        "DataSourceTypes.json": DEFAULT_DATA_SOURCE_TYPES_JSON,
        "DataProducts.json": DEFAULT_DATA_PRODUCTS_JSON,
    }

    for filename, content in files.items():
        with open(base_path / filename, "x", encoding="utf-8", newline="\n") as _f:
            _f.write(content)


def init_solution(solution_path: Path) -> None:
    solution = s.Solution(
        schemaVersion=config.latest_schema_version(),
        modelPath=Path("model"),
        basePath=Path("base"),
        pluginsPath=Path("plugins"),
        generatorTargets=[
            s.GeneratorTarget(
                name="default",
                sourcePath=Path("generate"),
                outputPath=Path("output"),
                isDefault=True,
            )
        ],
    )

    utils.mkdir(solution_path.parent, recursive=True)

    with open(solution_path, "x", encoding="utf-8", newline="\n") as _f:
        _f.write(solution.model_dump_json(**model.MODEL_DUMP_OPTIONS))

    base_dirs = ["model", "base", "generate", "output", "plugins"]
    for dir_name in base_dirs:
        utils.mkdir(solution_path.parent / dir_name)
        with open(solution_path.parent / dir_name / ".gitkeep", "x", encoding="utf-8") as _f:
            _f.write("")

    _write_default_base_entities(solution_path.parent / "base")


def init_solution_from_sample(solution_path: Path) -> str:
    "Downloads the sample solution and returns the initialed version"
    try:
        response = requests.get(
            f"{SAMPLE_SOLUTION_REPO_URL}/archive/refs/tags/v{SAMPLE_SOLUTION_VERSION}.zip"
        )
    except Exception as err:
        raise utils.create_error(f"Could not download sample solution: {err}")

    if response.status_code != 200:
        raise utils.create_error(f"Could not download sample solution: {response.status_code}")

    with zipfile.ZipFile(io.BytesIO(response.content)) as zip_file:
        zip_file.extractall(solution_path.parent)

    # the repsitory is in a sub directory, so its needs to be moved one directory up
    for _sub in (solution_path.parent / f"datam8-sample-solution-{SAMPLE_SOLUTION_VERSION}").glob(
        "*"
    ):
        shutil.move(_sub, solution_path.parent)

    # cleanup now empty dir
    os.rmdir(solution_path.parent / f"datam8-sample-solution-{SAMPLE_SOLUTION_VERSION}/")

    return SAMPLE_SOLUTION_VERSION

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

from pytest_cases import parametrize


class CasesLayer:
    @parametrize("layer", ["stage", "core", "curated"])
    def case_layer_valid(self, layer):
        return layer


class CasesLocator:
    @parametrize(
        "locator",
        [
            "attributeTypes/Generic Int",
            "dataProducts/Sales",
            "dataSources/AdventureWorks",
            "dataSourceTypes/SQLServer",
            "dataTypes/string",
            "properties/jobs",
            "zones/raw",
            "folders/020-Core/Sales",
        ],
    )
    def case_locator_valid(self, locator):
        return locator

    @parametrize(
        "locator",
        [
            "//Sales/Product/Product",
            "/010-staging",
            "|010-staging|Sales|Product|Product",
        ],
    )
    def case_locator_invalid(self, locator):
        return locator

    def case_locator_multiple(self):
        return "dataProducts/"

    def case_locator_unkown(self):
        return "/010-staging/Sales/Delivery/Product"

    # fmt: off
    @parametrize(
        "test_case",
        [
            # tuple-format (left side, right side, expected result
            ("dataProducts/Sales", "dataProducts/", True),
            ("dataProducts/Sales", "dataProducts/Sales", True),
            ("properties/jobs", "propertyValues/", False),
            ("modelEntities/Sales/Customer/Customer", "modelEntities/Sales/", True),
            ("modelEntities/Sales/Customer/", "modelEntities/Sales/", True),
        ],
    )
    # fmt: on
    def case_locator_comparison(self, test_case):
        return test_case


class CasesModel:
    @parametrize(
        "attribute",
        [
            "modelEntities",
            "properties",
            "dataSources",
        ],
    )
    def case_model_attributes(self, attribute):
        return attribute

    @parametrize(
        "function",
        [
            "get_data_type",
            "get_data_source",
        ],
    )
    def case_model_functions(self, function):
        return function


class CasesEntityLookup:
    @parametrize(
        "input",
        [
            ("dataTypes", ["string", "money"]),
            ("attributeTypes", ["Amt", "BirthDate"]),
            ("zones", ["raw", "core"]),
            ("properties", ["jobs"]),
            ("dataSources", ["AdventureWorks"]),
            ("dataSourceTypes", ["SQLServer"]),
            ("dataProducts", ["Sales"]),
            ("dataModules", ["Sales/Other"]),
        ],
    )
    def case_get_entity_dict_valid(self, input):
        return input

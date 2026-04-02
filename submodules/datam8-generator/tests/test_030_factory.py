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

import pytest_cases
from test_030_factory_cases import CasesPropertyValueResolution

from datam8 import factory
from datam8.model import Locator, Model, PropertyReference


@pytest_cases.parametrize_with_cases("input", cases=CasesPropertyValueResolution, glob="*_valid")
def test_resolve_property(input, model: Model):
    property, value = input[0].split("/")
    ref = PropertyReference(property=property, value=value)

    lookuped_values = sorted(factory.resolve_property(model, ref), key=lambda x: x.property)
    expected_values = sorted(
        [
            model.propertyValues[Locator.from_path(f"/propertyValues/{ref}")].entity
            for ref in input[1]
        ],
        key=lambda x: x.property,
    )

    assert lookuped_values == expected_values, (
        "Resolved properties do not match expected ones: "
        f"{[x.property for x in expected_values]} but got {[x.property for x in lookuped_values]}"
    )

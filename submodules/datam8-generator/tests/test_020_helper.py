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

import pytest
from pytest_cases import parametrize_with_cases
from test_020_helper_cases import (
    AlgorithmCases,
    HashCases,
    UuidCases,
)

from datam8.utils import hasher as hashutils


@parametrize_with_cases("algorithm", cases=AlgorithmCases, glob="*_valid")
@parametrize_with_cases("input", cases=HashCases, glob="*_valid")
def test_hasher_hash(input, algorithm):
    input, checksum = input
    hasher = hashutils.Hasher(algorithm)
    hash = hasher.hash(input)

    assert hash.hexdigest() == checksum


@parametrize_with_cases("algorithm", cases=AlgorithmCases, glob="*_valid")
@parametrize_with_cases("input", cases=UuidCases, glob="*_valid")
def test_hasher_create_uuid(input, algorithm):
    input, checksum = input
    hasher = hashutils.Hasher(algorithm)
    uuid = hasher.create_uuid(input)

    assert str(uuid) == checksum


@parametrize_with_cases("algorithm", cases=AlgorithmCases, glob="*_invalid")
def test_hasher(algorithm):
    with pytest.raises(hashutils.UnknownAlgorithmError):
        hashutils.Hasher(algorithm)

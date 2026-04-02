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


class AlgorithmCases:
    @parametrize("algorithm", ["SHA256"])
    def case_algorithm_valid(self, algorithm):
        return algorithm

    @parametrize("algorithm", ["MD5"])
    def case_algorithm_invalid(self, algorithm):
        return algorithm


class HashCases:
    @parametrize(
        "input",
        # fmt: off
        [
            # format: ("input", "64-byte hash")
            ("test", "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"),
            ("test2", "60303ae22b998861bce3b28f33eec1be758a213c86c93c076dbe9f558c11c752"),
        ],
        # fmt: on
    )
    def case_hashes_valid(self, input):
        return input


class UuidCases:
    @parametrize(
        "input",
        [
            # format: ("input", "uuid")
            ("test", "98d88476-92ea-c5d1-ab41-2082d561bf00"),
            ("test2", "633e2986-beb8-3ecb-7823-8c306b9581c5"),
        ],
    )
    def case_uuid_valid(self, input):
        return input

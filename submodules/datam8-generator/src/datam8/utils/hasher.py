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

"""
Wrapper around python's builtin hashlib module for direct usage within jinja2 templates.
"""

import hashlib
from enum import Enum
from uuid import UUID


class Algorithm(Enum):
    SHA256 = 0


class UnknownAlgorithmError(Exception):
    def __ini__(self, algorithm: str):
        super().__init__(f"Unkown algorithm: {algorithm}")


class Hasher:
    __algorithm: Algorithm

    @property
    def algorithm(self) -> Algorithm:
        return self.__algorithm

    def __init__(self, algorithm: str = Algorithm.SHA256.name) -> None:
        if algorithm not in Algorithm._member_names_:
            raise UnknownAlgorithmError(algorithm)

        self.__algorithm = Algorithm[algorithm]

    # HACK: return type needs to be in double-quote otherwis the code fails
    def hash(self, input: str) -> "hashlib._Hash":
        input_encoded = input.encode()

        match self.__algorithm:
            case Algorithm.SHA256:
                hash_object = hashlib.sha256(input_encoded)

        return hash_object

    def create_uuid(self, input: str) -> UUID:
        hash = self.hash(input)

        if self.__algorithm == Algorithm.SHA256:
            uuid = UUID(hash.hexdigest()[::2])
        else:
            uuid = UUID(hash.hexdigest())

        return uuid

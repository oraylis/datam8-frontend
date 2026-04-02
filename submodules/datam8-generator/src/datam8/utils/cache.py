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
Simple caching module to use during template rendering when generating or
creating values, by using the following classes.

* Cache
* CacheEntry
"""

from dataclasses import dataclass
from typing import Any


@dataclass
class CacheEntry:
    type: type
    value: Any


class Cache:
    __dict: dict[str, CacheEntry]

    def __init__(self) -> None:
        self.__dict = {}

    def get(self, key: str) -> Any:
        """Get a value from the cache by key.

        Parameters
        ----------
        key : `str`
            identifier to retrieve the value for.

        Returns
        ---------------
        The value matching the given key.
        """
        return self.__dict[key].value

    def set(self, key: str, value: Any) -> Any:
        """Set the value in cache by key and return it.

        Parameters
        ----------
        key : `str`
            identifier to set the value.
        value : `Any`
            value to set.

        Returns
        -------
        The newly set value.
        """
        self.__dict[key] = CacheEntry(type=type(value), value=value)
        return value

    @property
    def all(self) -> dict[str, CacheEntry]:
        """Return the complete cache dictionary."""
        return self.__dict

    @property
    def items(self) -> dict[str, Any]:
        """Return all key-value pairs currently in the cache."""
        return {k: v.value for k, v in self.__dict.items()}

    @property
    def values(self) -> list[Any]:
        """Return all values currently in the cache."""
        return [v.value for v in self.__dict.values()]

    def __str__(self):
        return "Cached Items: " + ", ".join(
            [f"{k}({str(v.value)})" for k, v in self.__dict.items()]
        )

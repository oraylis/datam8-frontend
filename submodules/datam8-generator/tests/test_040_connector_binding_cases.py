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

from __future__ import annotations

from pytest_cases import parametrize


class CasesConnectorBindingDecode:
    @parametrize(
        "connection_properties, expected_id, expected_version",
        [
            (None, None, None),
            ([], None, None),
            ([{"name": "host", "required": True}], None, None),
            ([{"name": "__connector.id=postgresql", "required": True}], "postgresql", None),
            (
                [
                    {"name": "__connector.id=sqlserver", "required": True},
                    {"name": "__connector.version=0.1.0", "required": False},
                ],
                "sqlserver",
                "0.1.0",
            ),
        ],
    )
    def case_decode_valid(self, connection_properties, expected_id, expected_version):
        return connection_properties, expected_id, expected_version

    @parametrize(
        "connection_properties",
        [
            [
                {"name": "__connector.id=a", "required": True},
                {"name": "__connector.id=b", "required": True},
            ],
            [
                {"name": "__connector.id=a", "required": True},
                {"name": "__connector.version=1.0.0", "required": False},
                {"name": "__connector.version=2.0.0", "required": False},
            ],
        ],
    )
    def case_decode_invalid(self, connection_properties):
        return connection_properties


class CasesConnectorBindingEncode:
    @parametrize(
        "connection_properties, connector_id, connector_version, expected_names",
        [
            (
                [
                    {"name": "host", "required": True},
                    {"name": "__connector.id=old", "required": True},
                    {"name": "__connector.version=>=0.1.0", "required": False},
                ],
                "new",
                "0.2.0",
                {"host", "__connector.id=new", "__connector.version=0.2.0"},
            ),
        ],
    )
    def case_encode_overwrite_reserved(
        self, connection_properties, connector_id, connector_version, expected_names
    ):
        return connection_properties, connector_id, connector_version, expected_names

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

import asyncio
from pathlib import PurePosixPath

import pytest

import datam8.secrets as secrets_module
from datam8.api.routes.secrets import SetSecretBody, set_secret
from datam8.secrets import SecretResolver


@pytest.fixture
def fake_secret_backend(monkeypatch: pytest.MonkeyPatch):
    store: dict[tuple[str, str], str] = {}

    def _set_password(service: str, username: str, value: str) -> None:
        store[(service, username)] = value

    def _get_password(service: str, username: str) -> str | None:
        return store.get((service, username))

    def _delete_password(service: str, username: str) -> None:
        store.pop((service, username), None)

    monkeypatch.setattr(secrets_module.keyring, "set_password", _set_password)
    monkeypatch.setattr(secrets_module.keyring, "get_password", _get_password)
    monkeypatch.setattr(secrets_module.keyring, "delete_password", _delete_password)
    monkeypatch.setattr(secrets_module.config, "get_name", lambda: "test-solution")
    monkeypatch.setattr(secrets_module.os, "getlogin", lambda: "tester")
    SecretResolver.reset_singleton()
    yield store
    SecretResolver.reset_singleton()


def test_secret_resolver_force_upsert_and_strict_ref_format(fake_secret_backend: dict[tuple[str, str], str]):
    _ = fake_secret_backend
    resolver = SecretResolver()
    path = "datasources/AdventureWorks/password"

    resolver.set_secret(path, "initial")
    with pytest.raises(Exception, match="already exists"):
        resolver.set_secret(path, "should-fail-without-force")

    resolver.set_secret(path, "updated", force=True)

    assert resolver.get_secret(path) == "updated"
    assert resolver.get_secret(f"ref://{path}") == "updated"
    assert resolver.get_secret(f"secretRef://{path}") is None
    assert resolver.list_secrets() == [PurePosixPath(path)]


def test_set_secret_route_behaves_as_upsert(fake_secret_backend: dict[tuple[str, str], str]):
    _ = fake_secret_backend
    path = "datasources/AdventureWorks/password"

    first = asyncio.run(set_secret(SetSecretBody(path=path, value="v1")))
    second = asyncio.run(set_secret(SetSecretBody(path=path, value="v2")))

    assert first.status_code == 204
    assert second.status_code == 204
    assert SecretResolver().get_secret(f"ref://{path}") == "v2"
    assert SecretResolver().list_secrets() == [PurePosixPath(path)]

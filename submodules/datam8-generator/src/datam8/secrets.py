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

import os
from contextlib import suppress
from pathlib import PurePosixPath
from threading import Lock

import keyring

from datam8 import config, logging, utils

logger = logging.getLogger(__name__)

ENV_VAR_PREFIX: str = "DATAM8_SECRET__"
SECRET_PREFIX: str = "datam8:"


def _ensure_path(path: PurePosixPath | str) -> PurePosixPath:
    if isinstance(path, str):
        return PurePosixPath(path.strip().removeprefix("ref://"))
    return path


def _path_to_env_var(path: PurePosixPath) -> str:
    upper_ = path.as_posix().upper()
    replaced_ = upper_.replace("/", "_")
    return f"{ENV_VAR_PREFIX}{replaced_}"


class SecretResolver:
    __instance: SecretResolver | None = None
    __lock = Lock()

    def __new__(cls) -> SecretResolver:
        if cls.__instance is None:
            with cls.__lock:
                if cls.__instance is None:
                    cls.__instance = super().__new__(cls)

        return cls.__instance

    @classmethod
    def reset_singleton(cls) -> None:
        with cls.__lock:
            cls.__instance = None

    def __init__(self) -> None:
        self.__service_name = f"{SECRET_PREFIX}{config.get_name()}"
        self.__username = os.getlogin()
        self.lock = Lock()

    #
    # private methods with thread safety
    #

    def __set_password(self, service: str, value: str, /) -> None:
        logger.debug("Setting '%s'", service)
        keyring.set_password(service, self.__username, value)

    def __get_password(self, service: str, /) -> str | None:
        logger.debug("Getting '%s'", service)
        return keyring.get_password(service, self.__username)

    def __unset_password(self, service: str, /) -> None:
        logger.debug("Unsetting '%s'", service)
        keyring.delete_password(service, self.__username)

    def __register_secret(self, path: PurePosixPath, /) -> None:
        service_name = self.__create_service_name()
        secrets = self.__get_password(service_name)
        posix_path = path.as_posix()

        logger.debug(f"Before register: {secrets}")

        if secrets is None or secrets == "":
            secrets = posix_path
        else:
            entries = [entry for entry in secrets.split(",") if entry]
            if posix_path in entries:
                logger.debug("Secret already registered: %s", posix_path)
                return
            entries.append(posix_path)
            secrets = ",".join(entries)

        self.__set_password(service_name, secrets)
        logger.debug(f"After register: {secrets}")

    def __unregister_secret(self, path: PurePosixPath, /) -> None:
        service_name = self.__create_service_name()
        current_secrets = self.__get_password(service_name)
        current_secrets = [] if current_secrets is None else current_secrets.split(",")
        posix_path = path.as_posix()

        logger.debug(f"Before unregister: {current_secrets}")

        if posix_path not in current_secrets:
            logger.warning("Trying to unregister non existing secret")
            return

        path_index = current_secrets.index(posix_path)
        current_secrets.pop(path_index)

        logger.debug(f"After unregister: {current_secrets}")

        self.__set_password(service_name, ",".join(current_secrets))

    def __create_service_name(self, path: PurePosixPath | None = None, /) -> str:
        if path is None:
            return f"{self.__service_name}"
        return f"{self.__service_name}/{path.as_posix()}"

    #
    # public methods - enforcing thread safety
    #

    def set_secret(self, path: PurePosixPath | str, value: str, /, *, force: bool = False) -> None:
        "Set a new secret or overwrite an existing one"
        path_ = _ensure_path(path)
        service_name = self.__create_service_name(path_)

        with self.lock:
            existing_secret = self.get_secret(path_)

            if existing_secret is not None and not force:
                raise utils.create_error(f"Trying to set secret but it already exists: {path_}")

            self.__set_password(service_name, value)
            self.__register_secret(path_)

    def unset_secret(self, path: PurePosixPath | str, /) -> None:
        "Remove a secret from the keyring backend"
        path_ = _ensure_path(path)
        service_name = self.__create_service_name(path_)

        with self.lock:
            existing_secret = self.get_secret(path_)
            self.__unregister_secret(path_)

            if existing_secret is None:
                raise utils.create_error(f"Trying to unset non existing secret: {path_}")

            self.__unset_password(service_name)

    def list_secrets(self) -> list[PurePosixPath]:
        "Returns a list of available secrets"
        service_name = self.__create_service_name()

        with self.lock:
            secrets = self.__get_password(service_name)

        if secrets is None or len(secrets) == 0:
            return []

        secret_list = secrets.split(",")

        logger.debug("Secret registry: '%s' [%s]", secrets, len(secret_list))

        return [PurePosixPath(p) for p in secret_list]

    def get_secret(self, path: PurePosixPath | str, /) -> str | None:
        path_ = _ensure_path(path)
        service_name = self.__create_service_name(path_)

        # in case secret is no secret backend, try env var
        secret = os.getenv(
            _path_to_env_var(path_),
            self.__get_password(service_name),
        )

        return secret

    def clean(self) -> None:
        secrets = self.list_secrets()
        with suppress(Exception), self.lock:
            for s in secrets:
                self.__unset_password(self.__create_service_name(s))
            self.__unset_password(self.__create_service_name())

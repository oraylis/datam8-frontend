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

from collections.abc import Sequence
from typing import Any

from pydantic import BaseModel


class PayloadRegisteredMultipleTimesError(Exception):
    def __init__(self, payload_name, /):
        super().__init__(f"Payload [{payload_name}] already registered.")


class ErrorEnvelope(BaseModel):
    """Stable JSON envelope for API error responses."""

    code: str
    message: str
    details: Any = None
    hint: str | None = None
    traceId: str | None = None


class Datam8Error(Exception):
    def __init__(
        self,
        *,
        code: str,
        message: str,
        details: Any = None,
        hint: str | None = None,
        exit_code: int = 10,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details
        self.hint = hint
        self.exit_code = exit_code

    def to_envelope(self, *, trace_id: str | None = None) -> ErrorEnvelope:
        return ErrorEnvelope(
            code=self.code,
            message=self.message,
            details=self.details,
            hint=self.hint,
            traceId=trace_id,
        )


class Datam8NotFoundError(Datam8Error):
    def __init__(
        self, *, code: str = "not_found", message: str, details: Any = None, hint: str | None = None
    ):
        super().__init__(code=code, message=message, details=details, hint=hint, exit_code=3)


class Datam8ValidationError(Datam8Error):
    def __init__(
        self,
        *,
        code: str = "validation_error",
        message: str,
        details: Any = None,
        hint: str | None = None,
    ):
        super().__init__(code=code, message=message, details=details, hint=hint, exit_code=2)


class ModelParseError(Exception):
    def __init__(
        self,
        msg="Error(s) occured during model files parsing.",
        inner_exceptions: Sequence[Exception] = [],
    ):
        Exception.__init__(self, msg)

        self.inner_exceptions = inner_exceptions
        self.message = msg

    def __str__(self) -> str:
        if not self.inner_exceptions:
            return self.message
        details = "\n".join(str(err) for err in self.inner_exceptions)
        return f"{self.message}\n{details}"


class NotSupportedModelVersionError(Exception):
    def __init__(self, version: str):
        super().__init__(f"Tried to parse an unsupported model version: {version}")


class EntityNotFoundError(Exception):
    def __init__(
        self,
        entity: str,
        msg: str = "Entity was not found in model: {}",
        inner_exceptions: list[Exception] | None = None,
    ):
        Exception.__init__(self, msg.format(entity))

        self.inner_exceptions = inner_exceptions
        self.message = msg.format(entity)


class InvalidLocatorError(Exception):
    def __init__(self, locator: str):
        super().__init__(f"Not a valid locator: {locator}")


class PropertiesNotResolvedError(Exception):
    def __init__(self, locator):
        super().__init__(f"Tried to access properties of unresolved entity '{locator}' yet")


class InvalidGeneratorTargetError(Exception):
    def __init__(self, target_name: str):
        super().__init__(f"Generator target '{target_name}' is not defined")

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

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel

from datam8.secrets import SecretResolver

secrets_router = APIRouter(prefix="/secrets", tags=["secrets"])


class CheckSecretBody(BaseModel):
    path: str


@secrets_router.post("/check")
async def check_secret(body: CheckSecretBody) -> None:
    "Checks if a secret is available for the given path"
    if SecretResolver().get_secret(body.path) is None:
        raise HTTPException(status_code=404, detail="Secret is not available")


class SetSecretBody(CheckSecretBody):
    value: str


@secrets_router.put("/set")
async def set_secret(body: SetSecretBody) -> Response:
    "Set a secret with the given value"
    SecretResolver().set_secret(body.path, body.value, force=True)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

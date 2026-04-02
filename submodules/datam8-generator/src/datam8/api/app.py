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
import socket
import uuid
from contextlib import asynccontextmanager

import typer

try:
    import uvicorn
    from fastapi import FastAPI, Request
    from fastapi.exceptions import RequestValidationError
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse
except ModuleNotFoundError as err:
    typer.echo("Required modules for API not installed - Install the 'api' extra")
    raise typer.Exit(1) from err


from datam8 import config, factory, logging
from datam8.errors import Datam8Error, Datam8ValidationError

from .routes import router

logger = logging.getLogger(__name__)


def _status_for_error(err: Datam8Error) -> int:
    match [err.code, err.exit_code]:
        case ["validation_error", _]:
            return 400
        case ["not_found", _]:
            return 404
        case ["conflict" | "locked", _]:
            return 409
        case ["auth", _]:
            return 401
        case ["permission", _]:
            return 403
        case ["not_implemented", _]:
            return 501
        case [_, 5]:
            return 502
        case _:
            return 500


def _is_exempt_path(path: str) -> bool:
    return path in {"/health", "/version"}


def _bind(host: str, port: int) -> tuple[socket.socket, int]:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((host, port))
    sock.listen(128)
    actual_port = int(sock.getsockname()[1])
    return sock, actual_port


def create_server(
    host: str, port: int, token: str | None = None, enable_openapi: bool = False
) -> uvicorn.Server:
    """Create and configure the HTTP API application."""
    base_url = f"http://{host}:{port}"

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        print(
            f"API ready at `{base_url}`, schemaVersion: {factory.get_model().solution.schemaVersion}"
        )
        yield

    if enable_openapi:
        app = FastAPI(title="DataM8 API", version=config.get_version(), lifespan=lifespan)
    else:
        app = FastAPI(
            title="DataM8 API",
            version=config.get_version(),
            docs_url=None,
            redoc_url=None,
            openapi_url=None,
            lifespan=lifespan,
        )

    origins_env = os.environ.get("DATAM8_CORS_ORIGINS")
    allow_origin_regex = os.environ.get("DATAM8_CORS_ORIGIN_REGEX")
    allow_origins = [o.strip() for o in (origins_env or "").split(",") if o.strip()]
    if not allow_origins:
        allow_origins = [
            "http://localhost:4320",
            "http://127.0.0.1:4320",
            "http://localhost:4321",
            "http://127.0.0.1:4321",
            "null",
        ]
    if not allow_origin_regex:
        allow_origin_regex = r"^http://(localhost|127\.0\.0\.1):\d+$"

    @app.middleware("http")
    async def trace_middleware(request: Request, call_next):
        request.state.trace_id = str(uuid.uuid4())
        return await call_next(request)

    if token is not None:

        @app.middleware("http")
        async def auth_middleware(request: Request, call_next):
            if _is_exempt_path(request.url.path):
                return await call_next(request)

            auth = (request.headers.get("authorization") or "").strip()
            if not auth.lower().startswith("bearer "):
                exc = Datam8Error(
                    code="auth",
                    message="Missing Authorization header.",
                    details=None,
                    hint="Use: Authorization: Bearer <token>.",
                    exit_code=7,
                )
                trace_id = getattr(request.state, "trace_id", None)
                env = exc.to_envelope(trace_id=trace_id)
                return JSONResponse(status_code=401, content=env.model_dump())
            got = auth.split(" ", 1)[1].strip()
            if not got or got != token:
                exc = Datam8Error(
                    code="auth",
                    message="Invalid token.",
                    details=None,
                    hint=None,
                    exit_code=7,
                )
                trace_id = getattr(request.state, "trace_id", None)
                env = exc.to_envelope(trace_id=trace_id)
                return JSONResponse(status_code=401, content=env.model_dump())

            return await call_next(request)

    # Add CORS outermost so preflight OPTIONS are handled before auth and
    # CORS headers are present on all responses (including errors).
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_origin_regex=allow_origin_regex,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(Datam8Error)
    async def datam8_error_handler(request: Request, exc: Datam8Error):
        trace_id = getattr(request.state, "trace_id", None)
        env = exc.to_envelope(trace_id=trace_id)
        return JSONResponse(status_code=_status_for_error(exc), content=env.model_dump())

    @app.exception_handler(RequestValidationError)
    async def request_validation_error_handler(request: Request, exc: RequestValidationError):
        trace_id = getattr(request.state, "trace_id", None)
        err = Datam8ValidationError(message="Invalid request.", details={"errors": exc.errors()})
        env = err.to_envelope(trace_id=trace_id)
        return JSONResponse(status_code=400, content=env.model_dump())

    @app.exception_handler(Exception)
    async def unexpected_error_handler(request: Request, exc: Exception):
        trace_id = getattr(request.state, "trace_id", None)
        env = Datam8Error(
            code="unexpected",
            message="Unexpected error.",
            details=None,
            hint=None,
            exit_code=10,
        ).to_envelope(trace_id=trace_id)
        return JSONResponse(status_code=500, content=env.model_dump())

    app.include_router(router)

    server = uvicorn.Server(
        uvicorn.Config(
            app,
            host=host,
            port=port,
            log_level=config.log_level.value,
            access_log=False,
        )
    )

    return server

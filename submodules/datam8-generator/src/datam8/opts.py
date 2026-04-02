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

from enum import Enum
from pathlib import Path
from typing import Annotated

import typer

default_target = "none"


class LogLevels(Enum):
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class Selectors(Enum):
    AUTO = "auto"
    RELATIVE = "relPath"
    LOCATOR = "locator"
    ID = "id"
    NAME = "name"
    PROPERTY = "property"


Lazy = Annotated[
    bool,
    typer.Option(
        "--lazy",
        help=(
            "Resolve properties only when access. "
            "Use with care as problems can occure when resolving properties in parallel."
        ),
    ),
]


LogLevel = Annotated[
    LogLevels,
    typer.Option(
        "--log-level",
        "-l",
        help="Set log level",
        envvar="DATAM8_LOG_LEVEL",
    ),
]


SolutionPath = Annotated[
    Path,
    typer.Option(
        "--solution",
        "-s",
        "--solution-path",
        help=(
            "Path to .dm8s solution file (or folder containing exactly one .dm8s file). Falls back to"
            " the current dir if not provided."
        ),
        envvar="DATAM8_SOLUTION_PATH",
        default_factory=Path().cwd,
    ),
]

SolutionName = Annotated[
    str, typer.Argument(help="Name for the new solution. Will mainly influence the dm8s file name.")
]

SolutionPathOptional = Annotated[Path | None, typer.Option()]

JsonOutput = Annotated[
    bool,
    typer.Option(
        "--json",
        help="Emit machine-readable JSON output.",
    ),
]

Quiet = Annotated[
    bool,
    typer.Option(
        "--quiet",
        help="Reduce human-readable output.",
    ),
]

Verbose = Annotated[
    bool,
    typer.Option(
        "--verbose",
        help="Increase human-readable output.",
    ),
]

LogFile = Annotated[
    str | None,
    typer.Option(
        "--log-file",
        help="Optional log output file.",
    ),
]

LockTimeout = Annotated[
    str,
    typer.Option(
        "--lock-timeout",
        help="Solution lock timeout (e.g. 10s, 2m).",
    ),
]

NoLock = Annotated[
    bool,
    typer.Option(
        "--no-lock",
        help="Disable solution lock (dangerous).",
    ),
]

GeneratorTarget = Annotated[
    str,
    typer.Argument(
        help="Target name as defined in .dm8s file",
        envvar="DATAM8_GENERATOR_TARGET",
    ),
]

AllTargets = Annotated[
    bool,
    typer.Option(
        "--all",
        help="Generates all targets in sequence",
        envvar="DATAM8_GENERATE_ALL_TARGETS",
    ),
]

CleanOutput = Annotated[
    bool,
    typer.Option(
        "--clean-output",
        "-c",
        help="Cleans the output directory, i.e. deleting its content",
        envvar="DATAM8_CLEAN_OUTPUT",
    ),
]

Payload = Annotated[
    list[str],
    typer.Option(
        "--payload",
        "-p",
        help="The name of a payload registrated via decorator. Can be provided multiple times",
    ),
]

MigrationOutputDir = Annotated[
    Path,
    typer.Option(
        "--output-dir",
        help="Directory where the migrated model will be written to",
    ),
]

OpenApi = Annotated[
    bool,
    typer.Option(
        "-o",
        "--openapi",
        help="When enabled an open api documentation page will be hosted alongside the api",
    ),
]

Selector = Annotated[
    str,
    typer.Argument(help="Entity selector"),
]

SelectBy = Annotated[
    Selectors,
    typer.Option(
        "--by",
        help="Selector type",
    ),
]

ApiPort = Annotated[
    int,
    typer.Option("--port", min=0, max=65535, help="Port where the fastapi app will listen on"),
]

ApiHost = Annotated[
    str,
    typer.Option("--host", help="Host where the fastapi will listen on"),
]

ApiToken = Annotated[
    str | None,
    typer.Option("-t", "--token", help="Token to restrict access to the api"),
]

Version = Annotated[
    bool,
    typer.Option("--version", is_eager=True),
]

DataSource = Annotated[
    str,
    typer.Argument(help="Name of a data source"),
]

Locator = Annotated[
    str,
    typer.Argument(help="A search locator"),
]

LocatorOpt = Annotated[
    str,
    typer.Option(help="A locator to finetune search results"),
]

Limit = Annotated[
    int, typer.Option("--limit", "-n", help="Controls the max limit of rows to display", min=1)
]
ColLimit = Annotated[
    int | None, typer.Option("--column-limit", "-cn", help="Number of columns to display", min=1)
]

SchemaName = Annotated[str | None, typer.Option(help="Name of a source schema")]
TableName = Annotated[str, typer.Argument(help="Name of table in source")]

SecretPath = Annotated[Path, typer.Argument(help="Path to store the secret in the keyring backend")]

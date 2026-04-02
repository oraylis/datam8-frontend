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

import typer

from datam8 import config, errors, logging, opts

logger = logging.getLogger(__name__)


def main_callback(
    solution_path: opts.SolutionPath,
    log_level: opts.LogLevel = opts.LogLevels.WARNING,
    version: opts.Version = False,
) -> None:
    """CLI root callback."""
    version_callback(version)

    try:
        config.set_solution(solution_path)
    except errors.Datam8Error as err:
        typer.echo(err.message)
        raise typer.Exit(1)

    config.log_level = log_level

    logging.setup_logger()


def version_callback(value: bool) -> None:
    """Print CLI version when --version is passed."""
    if value:
        typer.echo(config.get_version())
        raise typer.Exit(code=0)

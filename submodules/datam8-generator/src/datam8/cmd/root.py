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
This module contains CLI commands to interact with the model, e.g. listing, adding or deleting
entities.

*Subcommands*
- list
- show

Not every part of datam8 is pre-imported, some parts, e.g. die api is only imported when commands  related
to those imports are executed. This reduces startup time.
"""

# ruff: noqa: I001

import sys

import typer

from datam8 import (
    config,
    logging,
    model,
    errors,
    opts,
    utils,
)

from . import common

logger = logging.getLogger(__name__)

app = typer.Typer(
    name="datam8",
    add_completion=False,
    no_args_is_help=True,
    pretty_exceptions_enable=True,
    pretty_exceptions_show_locals=False,
    pretty_exceptions_short=False,
    context_settings={
        "help_option_names": ["-h", "--help"],
    },
)
"App to interact with the model - used as the default/root app"


def __setup_model_for_cli(
    solution_path: opts.SolutionPath,
    log_level: opts.LogLevel,
    version: opts.Version,
) -> model.Model:
    config.lazy = True
    common.main_callback(solution_path, log_level, version)

    from datam8 import factory

    return factory.create_model_or_exit()


@app.callback(invoke_without_command=True)
def _callback(
    solution_path: opts.SolutionPath,
    log_level: opts.LogLevel = opts.LogLevels.WARNING,
    version: opts.Version = False,
):
    if version:
        typer.echo(config.get_version())
        raise typer.Exit(code=0)


@app.command()
def list(
    solution_path: opts.SolutionPath,
    locator: opts.Locator = "modelEntities",
    log_level: opts.LogLevel = opts.LogLevels.WARNING,
    version: opts.Version = False,
    json_output: opts.JsonOutput = False,
) -> None:
    """List model entities"""
    common.main_callback(solution_path, log_level, version)

    model = __setup_model_for_cli(solution_path, log_level, version)
    wrappers = model.get_entities(locator)

    if len(wrappers) == 0:
        utils.emit_result("No entities found for search locator")
        raise typer.Exit(1)

    utils.emit_result(
        f"{len(wrappers)} entities in total",
        *[str(wrapper.locator) for wrapper in wrappers],
        models=[wrapper.entity for wrapper in wrappers],
        json=json_output,
    )


@app.command()
def list_by_property(
    locator: opts.Locator,
    solution_path: opts.SolutionPath,
    model_locator: opts.LocatorOpt = "modelEntities",
    log_level: opts.LogLevel = opts.LogLevels.WARNING,
    version: opts.Version = False,
    json_output: opts.JsonOutput = False,
) -> None:
    "List Entities that have a specific property assigned. Searches for model entities by default."
    common.main_callback(solution_path, log_level, version)

    model = __setup_model_for_cli(solution_path, log_level, version)
    wrappers = model.get_entities_by_property(locator, model_locator)

    if len(wrappers) == 0:
        utils.emit_result("No entities found for search locator")
        raise typer.Exit(1)

    utils.emit_result(
        f"{len(wrappers)} entities in total",
        *[str(wrapper.locator) for wrapper in wrappers],
        models=[wrapper.entity for wrapper in wrappers],
        json=json_output,
    )


@app.command()
def show(
    selector: opts.Selector,
    solution_path: opts.SolutionPath,
    by: opts.SelectBy = opts.Selectors.LOCATOR,
    json_output: opts.JsonOutput = False,
    version: opts.Version = False,
    log_level: opts.LogLevel = opts.LogLevels.WARNING,
) -> None:
    """Get and display a model entity"""
    _model = __setup_model_for_cli(solution_path, log_level, version)
    entity_wrapper = None

    try:
        entity_wrapper = _model.get_entity_by_selector(selector, by=by)
    except errors.EntityNotFoundError as err:
        typer.echo(err)
        suggestions = []

        if by == opts.Selectors.LOCATOR:
            parent_locator = model.Locator.from_path(selector).parent
            typer.echo(parent_locator)
            suggestions = _model.get_entities(parent_locator) if parent_locator is not None else []

        if len(suggestions) > 0:
            typer.echo(f"Did you mean one of these?: {[str(w.locator) for w in suggestions]}")
        sys.exit(1)
    except ValueError as err:
        typer.echo(err)
        sys.exit(1)

    utils.emit_result(
        f"File: {entity_wrapper.source_file}",
        "\nProperties:",
        *entity_wrapper.properties.values(),
        "\nRaw Data:",
        entity_wrapper.entity,
        models=[entity_wrapper.entity],
        json=json_output,
        pretty=True,
    )


@app.command()
def validate(
    solution_path: opts.SolutionPath,
    log_level: opts.LogLevel = opts.LogLevels.WARNING,
    version: opts.Version = False,
):
    """Validate solution model"""
    _model = __setup_model_for_cli(solution_path, log_level, version)

    typer.echo("Validation successfull")


@app.command(name="generate")
def generate_cmd(
    solution_path: opts.SolutionPath,
    target: opts.GeneratorTarget = opts.default_target,
    log_level: opts.LogLevel = opts.LogLevels.WARNING,
    clean_output: opts.CleanOutput = False,
    payloads: opts.Payload = [],
    generate_all: opts.AllTargets = False,
    lazy: opts.Lazy = False,
    version: opts.Version = False,
):
    """Generate a jinja2 template configured in the solution file"""

    if generate_all:
        logger.warning("The --all option is set, but is currently ignored.")

    model = __setup_model_for_cli(solution_path, log_level, version)

    from datam8 import generate

    _ = generate.generate_output(
        model,
        target=target,
        payloads=payloads,
        generate_all=generate_all,
        clean_output=clean_output,
    )

    typer.echo("Generation successfull")


@app.command()
def init(
    name: opts.SolutionName,
    solution_path: opts.SolutionPath,
    log_level: opts.LogLevel = opts.LogLevels.INFO,
    version: opts.Version = False,
):
    """
    Initialise a new empty DataM8 solution with default base entities.
    """
    config.log_level = log_level
    common.version_callback(version)

    from datam8 import solution

    new_solution_path = solution_path.resolve()
    if solution_path.suffix != ".dm8s":
        new_solution_path = new_solution_path / f"{name}.dm8s"

    if new_solution_path.exists():
        raise utils.create_error(f"Solution file already exists: {new_solution_path}")

    if new_solution_path.parent.exists() and any(new_solution_path.parent.iterdir()):
        raise utils.create_error(f"Solution directory is not empty: {new_solution_path.parent}")

    solution.init_solution(new_solution_path)
    typer.echo(f"Blank solution created at {new_solution_path}")


@app.command()
def serve(
    solution_path: opts.SolutionPath,
    token: opts.ApiToken = None,
    host: opts.ApiHost = "127.0.0.1",
    port: opts.ApiPort = 0,
    openapi: opts.OpenApi = False,
    log_level: opts.LogLevel = opts.LogLevels.INFO,
    version: opts.Version = False,
):
    "Starts the DataM8 fastapi backend"
    from datam8.api import app as api_app  # for performance only import when needed
    from datam8 import factory

    config.mode = config.RunMode.API
    common.main_callback(solution_path, log_level, version)

    _ = factory.create_model()

    sock, actual_port = api_app._bind(host, port)
    server = api_app.create_server(
        host,
        actual_port,
        token=token.strip() if token is not None else token,
        enable_openapi=openapi,
    )
    server.run(sockets=[sock])

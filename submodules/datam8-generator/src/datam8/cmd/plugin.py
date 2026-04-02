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

from typing import Annotated

import rich
import typer

from datam8 import config, logging, opts, parser
from datam8.plugins import PluginManager, init_builtin_plugins

from . import common

logger = logging.getLogger(__name__)

app = typer.Typer(
    name="plugins",
    help="Subcommands to manage plugins",
    no_args_is_help=True,
    context_settings={
        "help_option_names": ["-h", "--help"],
    },
)


@app.command()
def list(
    solution_path: opts.SolutionPath,
    log_level: opts.LogLevel = opts.LogLevels.WARNING,
    version: opts.Version = False,
):
    "List available plugins"
    common.main_callback(solution_path, log_level, version)

    solution = parser.parse_solution_file(config.solution_path)
    init_builtin_plugins()

    for plugin in PluginManager(solution).get_plugins():
        rich.print(plugin)


@app.command()
def show(
    plugin_id: Annotated[str, typer.Argument(help="Plugin name")],
    solution_path: opts.SolutionPath,
    log_level: opts.LogLevel = opts.LogLevels.WARNING,
    version: opts.Version = False,
):
    "List available plugins"
    common.main_callback(solution_path, log_level, version)
    init_builtin_plugins(plugin_id=plugin_id)

    solution = parser.parse_solution_file(config.solution_path)
    pm = PluginManager(solution)
    plugin_manifest = pm.get_plugin_manifest(plugin_id)
    PluginClass = pm.get_plugin(plugin_manifest.id)

    rich.print(plugin_manifest)

    typer.echo("Connection Properties")
    rich.print(PluginClass.get_connection_properties())

    typer.echo("DataType mappings")
    rich.print(PluginClass.get_data_type_mappings())


@app.command("ui-schema")
def ui_schema(
    plugin_id: Annotated[str, typer.Argument(help="Plugin name")],
    solution_path: opts.SolutionPath,
    log_level: opts.LogLevel = opts.LogLevels.WARNING,
    version: opts.Version = False,
):
    "Prints the results of the uiSchema capability of a plugin (intended for debugging)"
    common.main_callback(solution_path, log_level, version)
    init_builtin_plugins(plugin_id=plugin_id)

    solution = parser.parse_solution_file(config.solution_path)
    PluginClass = PluginManager(solution).get_plugin(plugin_id)
    ui_schema = PluginClass.get_ui_schema()

    rich.print(ui_schema)

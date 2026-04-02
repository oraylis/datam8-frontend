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

import pathlib

import rich
import typer

from datam8 import config, migration_v1, opts, parser_v1, utils

from . import common

logger = utils.start_logger(__name__)

app = typer.Typer(
    name="migrate",
    help="Subcommands to migrate older models",
    no_args_is_help=True,
    context_settings={
        "help_option_names": ["-h", "--help"],
    },
)


@app.command("v1-to-v2")
def v1_to_v2(
    solution_path: opts.SolutionPath,
    output_dir: opts.MigrationOutputDir = pathlib.Path("migration"),
    log_level: opts.LogLevel = opts.LogLevels.WARNING,
    version: opts.Version = False,
):
    """Migrate solution model."""
    common.main_callback(solution_path, log_level, version)
    config.lazy = False

    solution, model_file_references = parser_v1.parse_solution_file(solution_path)

    final_output_dir = (
        output_dir if output_dir.is_absolute() else config.solution_folder_path / output_dir
    )

    utils.delete_path(final_output_dir, recursive=True)
    utils.mkdir(final_output_dir / "Model", recursive=True)

    migration_from_v1 = migration_v1.MigrationV1(model_file_references)

    new_base_entities = migration_from_v1.migrate_base_entities(
        base_dir_path=config.solution_folder_path / solution.basePath,
        output_path=final_output_dir / "Base",
    )

    zones = migration_from_v1.migrate_zones(solution, final_output_dir / "Base" / "zones.json")
    migration_from_v1.create_new_databricks_solution(final_output_dir / solution_path.name)

    tags: list[str] = []
    tags.extend(
        migration_from_v1.migrate_model_entities(
            model_dir_path=config.solution_folder_path / solution.stagingPath,
            output_path=final_output_dir / "Model" / solution.AreaTypes_1.Stage,
        )
    )
    tags.extend(
        migration_from_v1.migrate_model_entities(
            model_dir_path=config.solution_folder_path / solution.corePath,
            output_path=final_output_dir / "Model" / solution.AreaTypes_1.Core,
        )
    )
    tags.extend(
        migration_from_v1.migrate_model_entities(
            model_dir_path=config.solution_folder_path / solution.curatedPath,
            output_path=final_output_dir / "Model" / solution.AreaTypes_1.Curated,
        ),
    )

    migration_from_v1.create_new_properties(list(set(tags)), final_output_dir / "Base")
    migration_from_v1.create_properties_for_folders(
        zones=zones,
        data_products=new_base_entities.data_products,
        output_path=final_output_dir / "Model",
    )

    rich.print(f"Migration successfully written to {final_output_dir.as_posix()}")

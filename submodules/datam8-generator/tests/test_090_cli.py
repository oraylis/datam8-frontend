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

import re
from pathlib import Path

from config import DataM8TestConfig
from pytest_cases import parametrize_with_cases
from test_090_cli_cases import CasesCli
from typer.testing import CliRunner, Result

from datam8.app import app

ANSI_ESCAPE_RE = re.compile(r"\x1B\[[0-?]*[ -/]*[@-~]")


def _common_cli_assert(result: Result):
    assert result.exit_code == 0, f"Exit code was {result.exit_code}, expected 0"


def _run_cli(args: list[str], solution_path: Path) -> Result:
    return CliRunner().invoke(app, [*args, "-s", solution_path.as_posix()])


@parametrize_with_cases(
    "command_name",
    cases=CasesCli,
    glob="*top_level*",
)
def test_cli_print_help_text(command_name: str) -> None:
    runner = CliRunner()
    result = runner.invoke(app, [command_name, "-h"])

    help_text = f"Usage: datam8 {command_name}"

    assert help_text in result.output, f"'{help_text}' was not part of {result.output}"
    _common_cli_assert(result)


def test_cli_list(config: DataM8TestConfig) -> None:
    result = _run_cli(["list"], config.solution_file_path)
    result_lines = result.output.splitlines()

    assert result_lines[0].endswith("entities in total"), (
        f"The first line of the output must be a summary: [{result_lines[0]}]"
    )
    _common_cli_assert(result)


def test_cli_show(config: DataM8TestConfig) -> None:
    result_of_list = _run_cli(["list"], config.solution_file_path)
    # last line of output should be a model entity's locator
    locator = result_of_list.output.splitlines()[-1]

    result = _run_cli(["show", locator], config.solution_file_path)
    result_lines = result.output.splitlines()

    assert result_lines[0].startswith("File: "), (
        f"The first line of the output must be the file path: {result_lines[0]}"
    )
    _common_cli_assert(result)


def test_cli_validate(config: DataM8TestConfig) -> None:
    result = CliRunner().invoke(app, ["validate", "-s", config.solution_file_path.as_posix()])
    result_lines = result.output.splitlines()

    assert result_lines[-1] == "Validation successfull", (
        f"Validation did not finish successfully, output: {result_lines}"
    )
    _common_cli_assert(result)


def test_cli_generate(config: DataM8TestConfig) -> None:
    result = CliRunner().invoke(app, ["generate", "-s", config.solution_file_path.as_posix()])
    result_lines = result.output.splitlines()

    assert result_lines[-1] == "Generation successfull", (
        f"Generation did not finish successfully, output: {result_lines}"
    )
    _common_cli_assert(result)

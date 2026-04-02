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
Logging module to simplify and setup a common logging approach.
"""

from __future__ import annotations

import logging
import os
import pathlib
import sys
from datetime import datetime

# directly imported to expose them via this module
from logging import (  # noqa: F401
    CRITICAL,
    DEBUG,
    ERROR,
    INFO,
    WARNING,
    Formatter,
    Logger,
    getLogger,
)

from datam8 import config


def setup_logger(
    log_directory: pathlib.Path | None = None,
    enable_write_log: bool = False,
) -> None:
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(ColorFormatter())

    converted_log_level: str = config.log_level.value.upper()

    logging.basicConfig(
        level=converted_log_level,
        handlers=[stream_handler],
    )

    if enable_write_log:
        _log_directory = log_directory or config.solution_folder_path / "logs"
        # Create Log
        if not _log_directory.exists():
            os.makedirs(_log_directory)

        log_path = _log_directory / f"{datetime.now().strftime('%Y-%m-%d_%H:%M:%S')}.log"

        formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(name)s: %(message)s")
        file_handler = logging.FileHandler(log_path)
        file_handler.setFormatter(formatter)

        logging.root.addHandler(file_handler)

    # when running in debug mode always print the full traceback
    if logging.root.getEffectiveLevel() <= DEBUG:
        sys.tracebacklimit = 0


class ColorFormatter(Formatter):
    """Logging Formatter to add colors and count warning/errors"""

    grey = "\x1b[90m"
    green = "\x1b[92m"
    yellow = "\x1b[93m"
    red = "\x1b[91m"
    reset = "\x1b[0m"
    _time = grey + "%(asctime)s "
    _level = "[%(levelname)-5s] "
    _scope = grey + "%(name)s | "
    _msg = "%(message)s" + reset

    # fmt: off
    FORMATS = {
        DEBUG:    _time          + _level + _scope + reset + _msg,
        INFO:     _time + green  + _level + _scope + reset + _msg,
        WARNING:  _time + yellow + _level + _scope + reset + _msg,
        ERROR:    _time + red    + _level + _scope + red   + _msg,
        CRITICAL: _time + red    + _level + _scope + red   + _msg,
    }
    # fmt: on

    def format(self, record) -> str:
        record.levelname = "WARN" if record.levelname == "WARNING" else record.levelname
        record.levelname = "ERROR" if record.levelname == "CRITICAL" else record.levelname
        log_fmt = self.FORMATS.get(record.levelno)
        formatter = Formatter(log_fmt)
        return formatter.format(record)

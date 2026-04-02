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

import argparse
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SCAN_ROOTS = ("src", "tests", "scripts")


def _load_header() -> str:
    header_file = REPO_ROOT / "license_file_header.txt"
    content = header_file.read_text(encoding="utf-8")
    return content.rstrip() + "\n\n"


def _iter_python_files(scan_roots: tuple[str, ...]) -> list[Path]:
    files: list[Path] = []
    for root_name in scan_roots:
        root = REPO_ROOT / root_name
        if not root.exists():
            continue
        for path in root.rglob("*.py"):
            if "__pycache__" in path.parts:
                continue
            files.append(path)
    return sorted(files)


def _needs_header(content: str) -> bool:
    return not content.startswith("# DataM8")


def _with_header(content: str, header: str) -> str:
    if content.startswith("#!"):
        first_line, _, rest = content.partition("\n")
        return f"{first_line}\n{header}{rest}"
    return f"{header}{content}"


def _apply(path: Path, header: str, dry_run: bool) -> bool:
    current = path.read_text(encoding="utf-8")
    if not _needs_header(current):
        return False
    updated = _with_header(current, header)
    if not dry_run:
        path.write_text(updated, encoding="utf-8")
    return True


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Add DataM8 license header to Python files.")
    parser.add_argument(
        "--dry-run", action="store_true", help="Only print files that would be updated."
    )
    parser.add_argument(
        "--path",
        action="append",
        default=[],
        help="File or directory to process. Can be specified multiple times. Defaults to src/tests/scripts.",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    header = _load_header()

    if args.path:
        files: list[Path] = []
        for raw in args.path:
            p = (REPO_ROOT / raw).resolve() if not Path(raw).is_absolute() else Path(raw)
            if p.is_file() and p.suffix == ".py":
                files.append(p)
            elif p.is_dir():
                files.extend(sorted(pp for pp in p.rglob("*.py") if "__pycache__" not in pp.parts))
    else:
        files = _iter_python_files(DEFAULT_SCAN_ROOTS)

    changed: list[Path] = []
    for file_path in files:
        if _apply(file_path, header, args.dry_run):
            changed.append(file_path)

    for file_path in changed:
        print(file_path.relative_to(REPO_ROOT))

    print(f"updated={len(changed)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

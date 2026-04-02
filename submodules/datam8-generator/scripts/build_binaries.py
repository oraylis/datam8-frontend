from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _platform_subdir() -> str:
    if sys.platform == "win32":
        return "win"
    if sys.platform == "darwin":
        return "mac"
    if sys.platform == "linux":
        return "linux"
    raise RuntimeError(f"Unsupported platform: {sys.platform}")


def _exe_name(base: str) -> str:
    return f"{base}.exe" if sys.platform == "win32" else base


def _run(cmd: list[str], *, cwd: Path) -> None:
    subprocess.check_call(cmd, cwd=str(cwd))


def build(*, clean: bool = True, onefile: bool = True) -> Path:
    repo_root = _repo_root()
    platform_dir = _platform_subdir()

    dist_root = repo_root / "dist" / "bin" / platform_dir
    dist_root.mkdir(parents=True, exist_ok=True)

    build_dir = repo_root / "build" / "pyinstaller"
    spec_dir = repo_root / "build" / "pyinstaller-spec"
    pycache = repo_root / "__pycache__"

    if clean:
        for p in [build_dir, spec_dir, pycache]:
            try:
                if p.exists():
                    shutil.rmtree(p)
            except Exception:
                pass

    common = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--workpath",
        str(build_dir),
        "--specpath",
        str(spec_dir),
        "--distpath",
        str(dist_root),
        "--exclude-module",
        "pkg_resources",
        "--collect-submodules",
        "datam8",
        "--collect-submodules",
        "datam8_model",
    ]
    if clean:
        common.append("--clean")
    if onefile:
        common.append("--onefile")

    _run(
        common
        + [
            "--name",
            "datam8",
            str(repo_root / "pyinstaller" / "datam8_entrypoint.py"),
            str(repo_root / "pyinstaller" / "datam8.py"),
        ],
        cwd=repo_root,
    )

    bin_path = dist_root / _exe_name("datam8")
    if not bin_path.exists():
        raise RuntimeError(f"datam8 binary missing at {bin_path}")

    # Smoke: `datam8 --help` should work.
    _ = subprocess.check_output(
        [str(bin_path), "--help"], cwd=str(repo_root), env={**os.environ}, text=True
    )
    return dist_root


def main() -> None:
    clean = os.environ.get("DATAM8_PYI_CLEAN", "1") != "0"
    onefile = os.environ.get("DATAM8_PYI_ONEFILE", "1") != "0"
    out = build(clean=clean, onefile=onefile)
    print(str(out))


if __name__ == "__main__":
    main()

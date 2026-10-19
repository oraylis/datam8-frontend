"""Reduce and bundle an already-installed runtime, using its own interpreter.

Keep native/mixed packages on disk. The explicit archive
allowlist is intentionally conservative: package resources and dynamic imports
must continue working. Sources stay inside the archives for introspection.
"""

import compileall
import json
import py_compile
import shutil
import sys
import zipfile
from pathlib import Path

PURE_PACKAGES = (
    "fastapi",
    "starlette",
    "uvicorn",
    "rich",
    "pygments",
    "h11",
    "anyio",
    "sniffio",
    "annotated_types",
    "typing_inspection",
    "typing_extensions.py",
    "azure",
    "requests",
    "urllib3",
    "msal",
    "msal_extensions",
    "polars",
    "pydantic",
    "markdown_it",
    "jinja2",
    "keyring",
    "jsonschema",
    "jsonschema_specifications",
    "deepdiff",
    "attrs",
    "attr",
    "click",
    "typer",
    "idna",
    "jwt",
    "isodate",
    "referencing",
    "pycparser",
)
STDLIB_DEVELOPMENT = (
    "test",
    "idlelib",
    "tkinter",
    "turtledemo",
    "turtle.py",
    "ensurepip",
    "venv",
)


def remove(path):
    if path.is_symlink() or path.is_file():
        path.unlink()
    elif path.is_dir():
        shutil.rmtree(path)


def inventory(root):
    entries = list(root.rglob("*"))
    files = [p for p in entries if not p.is_symlink() and p.is_file()]
    return {
        "files": len(files),
        "bytes": sum(p.stat().st_size for p in files),
        "symlinks": sum(p.is_symlink() for p in entries),
    }


def require_pure_package(entry):
    if entry.is_dir() and any(
        p.suffix.lower() in {".pyd", ".dll", ".so", ".dylib"}
        for p in entry.rglob("*")
    ):
        raise RuntimeError(f"Package is no longer pure Python: {entry.name}")


def prune_package_development(packages):
    # PyCryptodome names its bundled test suite differently from other packages.
    remove(packages / "Crypto/SelfTest")
    for file in list(packages.rglob("*")):
        if (
            file.is_file()
            and file.suffix.lower() in {
                ".h", ".hh", ".hpp", ".hxx", ".c", ".cc", ".cpp", ".cxx",
                ".pyx", ".pxd", ".pxi", ".lib", ".pdb",
            }
            and not any(
                part.endswith(".dist-info") or part.lower() in {"licenses", "license"}
                for part in file.relative_to(packages).parts
            )
        ):
            remove(file)


def archive_paths(base, entries, destination, compression=zipfile.ZIP_STORED):
    # Uncompressed archives also work during interpreter bootstrap before zlib
    # is available. Legacy bytecode locations are understood by zipimport.
    for entry in entries:
        ok = (
            compileall.compile_dir(entry, quiet=1, legacy=True, optimize=0)
            if entry.is_dir()
            else compileall.compile_file(entry, quiet=1, legacy=True, optimize=0)
        )
        if not ok:
            raise RuntimeError(f"Bytecode compilation failed: {entry}")
    with zipfile.ZipFile(destination, "w", compression=compression) as archive:
        for entry in entries:
            files = (
                sorted(entry.rglob("*"))
                if entry.is_dir()
                else [entry, entry.with_suffix(".pyc")]
            )
            if entry.is_dir():
                archive.write(entry, entry.relative_to(base).as_posix() + "/")
            for file in files:
                if "__pycache__" not in file.parts:
                    archive.write(file, file.relative_to(base).as_posix())
    for entry in entries:
        remove(entry)
        if entry.suffix == ".py":
            remove(entry.with_suffix(".pyc"))


def prune_posix_development(root, stdlib):
    """Remove explicit desktop-unused inputs, retaining shared native libraries."""
    targets = [root / "include", root / "share/man", root / "share/doc"]
    targets.extend(stdlib.glob("config-*"))
    for pattern in ("tcl[0-9]*", "tk[0-9]*"):
        targets.extend(p for p in (root / "lib").glob(pattern) if p.is_dir())
    for pattern in ("idle*", "pydoc*", "2to3*", "python*-config"):
        targets.extend((root / "bin").glob(pattern))
    targets.extend((root / "lib/pkgconfig").glob("python*.pc"))
    targets.extend((stdlib / "lib-dynload").glob("_tkinter*.so"))
    removed = []
    for target in targets:
        if target.exists() or target.is_symlink():
            removed.append(str(target.relative_to(root)))
            remove(target)
    return removed


def prepare(root):
    root = root.resolve(strict=True)
    if Path(sys.prefix).resolve() != root:
        raise RuntimeError(
            "Run with the copied runtime interpreter, never the host Python"
        )
    marker = root / ".datam8-runtime-staging"
    if (
        not marker.is_file()
        or Path(marker.read_text(encoding="utf-8")).resolve() != root
    ):
        raise RuntimeError(
            "Refusing to prune a Python installation not staged by the DataM8 build"
        )
    before = inventory(root)
    stdlib = root / (
        "Lib"
        if sys.platform == "win32"
        else f"lib/python{sys.version_info.major}.{sys.version_info.minor}"
    )
    packages = stdlib / "site-packages"
    removed = []
    for name in STDLIB_DEVELOPMENT:
        target = stdlib / name
        if target.exists():
            removed.append(str(target.relative_to(root)))
            remove(target)
    # Runtime package tests are not a desktop feature. Preserve public helpers
    # such as unittest, polars.testing and all package metadata/licenses.
    for directory in sorted(
        packages.rglob("*"), key=lambda p: len(p.parts), reverse=True
    ):
        if (
            directory.is_dir()
            and directory.name in {"tests", "test", "__pycache__"}
            and not any(part.endswith(".dist-info") for part in directory.parts)
        ):
            remove(directory)
    for entry in stdlib.rglob("__pycache__"):
        if entry.is_dir():
            remove(entry)
    # C/Cython development inputs and Windows import libraries are not needed
    # by the shipped interpreter. Preserve metadata and license directories.
    self_tests = packages / "Crypto/SelfTest"
    if self_tests.exists():
        removed.append(str(self_tests.relative_to(root)))
    prune_package_development(packages)
    if sys.platform == "win32":
        for name in ("Doc", "include", "libs", "Scripts", "tcl", "Tools"):
            target = root / name
            if target.exists():
                removed.append(name)
                remove(target)
        for pattern in ("*_tkinter*", "tcl*.dll", "tk*.dll", "_test*.pyd"):
            for file in (root / "DLLs").glob(pattern):
                removed.append(str(file.relative_to(root)))
                remove(file)
    else:
        removed.extend(prune_posix_development(root, stdlib))
    stages = {"afterPruning": inventory(root)}

    # Leave native stdlib extensions, third-party packages, and the isolation
    # bootstrap external. Everything else in the stdlib can use normal zipimport.
    std_entries = [
        p
        for p in stdlib.iterdir()
        if p.name not in {"site-packages", "lib-dynload", "sitecustomize.py"}
        and (p.is_dir() or p.suffix == ".py")
    ]
    std_zip = (
        root / "lib" / f"python{sys.version_info.major}{sys.version_info.minor}.zip"
    )
    if sys.platform == "win32":
        std_zip = root / std_zip.name
    std_zip.parent.mkdir(exist_ok=True)
    archive_paths(stdlib, std_entries, std_zip)
    stages["afterStdlibArchive"] = inventory(root)
    pure_entries = [
        packages / name for name in PURE_PACKAGES if (packages / name).exists()
    ]
    for entry in pure_entries:
        require_pure_package(entry)
    archive_paths(
        packages, pure_entries, packages / "datam8-pure.zip", zipfile.ZIP_DEFLATED
    )
    # site initialization processes this relative path in the installed runtime.
    (packages / "datam8-pure.pth").write_text("datam8-pure.zip\n", encoding="utf-8")
    stages["afterPackageArchive"] = inventory(root)
    if sys.platform == "win32":
        # Ignore registry PythonPath entries from unrelated Python installations.
        # A mismatched native extension can crash before sitecustomize runs.
        (
            root / f"python{sys.version_info.major}{sys.version_info.minor}._pth"
        ).write_text(
            f"{std_zip.name}\nDLLs\nLib\nLib/site-packages\n.\nimport site\n",
            encoding="utf-8",
        )
    # Native/mixed packages stay external but get valid, relocation-safe bytecode.
    if not compileall.compile_dir(
        packages,
        quiet=1,
        optimize=0,
        invalidation_mode=py_compile.PycInvalidationMode.UNCHECKED_HASH,
    ):
        raise RuntimeError("External package bytecode compilation failed")
    compileall.compile_file(
        stdlib / "sitecustomize.py",
        quiet=1,
        invalidation_mode=py_compile.PycInvalidationMode.UNCHECKED_HASH,
    )
    marker.unlink()
    manifest = {
        "python": sys.version.split()[0],
        "before": before,
        "after": inventory(root),
        "stages": stages,
        "inventoryScope": "Regular files and symlinks counted separately; after excludes this manifest, final inventory is in the test report",
        "removed": removed,
        "archivedPackages": [p.name for p in pure_entries],
        "stdlibArchive": str(std_zip.relative_to(root)),
    }
    (root / "runtime-manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    print(json.dumps(manifest))


if __name__ == "__main__":
    prepare(Path(sys.argv[1]))

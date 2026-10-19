"""Exercise the selected desktop runtime; no pytest, source checkout or services."""

import importlib
import inspect
import json
import secrets
import sys
import tempfile
from importlib.metadata import entry_points, version
from pathlib import Path


def write_json(file, data):
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def resources(root):
    import certifi
    import polars as pl
    import pyarrow as pa
    import pyarrow.parquet as pq
    import pydantic
    from jsonschema import Draft202012Validator
    from datam8 import plugins
    from datam8.plugins.manager import PluginManager

    assert Path(sys.prefix).resolve() == root, (sys.prefix, root)
    assert sys.dont_write_bytecode, "Runtime must not write bytecode into its bundle"
    assert Path(certifi.where()).is_file()
    # These APIs need source/resources and metadata after pure-package ZIP import.
    assert "class DataFrame" in inspect.getsource(pl.DataFrame)
    assert "class BaseModel" in inspect.getsource(pydantic.BaseModel)
    assert pl.DataFrame({"value": [1, 2]}).select(pl.col("value") * 3)["value"].to_list() == [3, 6]
    schema = {"type": "object", "properties": {"value": {"type": "integer"}}}
    Draft202012Validator.check_schema(schema)
    Draft202012Validator(schema).validate({"value": 1})
    crypto_backend = [ep for ep in entry_points(group="keyring.backends")
                      if ep.value.startswith("keyrings.cryptfile")]
    assert crypto_backend, "Encrypted keyring entry point is missing"
    for ep in crypto_backend:
        ep.load()
    modules = (
        "ssl", "sqlite3", "lzma", "decimal", "ctypes", "encodings", "fastapi",
        "rich", "azure.identity", "azure.storage.filedatalake", "msal", "requests",
        "pydantic_core", "yaml", "connectorx", "deltalake", "datam8", "datam8_model",
    )
    for name in modules:
        module = importlib.import_module(name)
        file = getattr(module, "__file__", None)
        if file:
            assert Path(file).resolve().is_relative_to(root), (name, file)
    plugins.init_builtin_plugins()
    manager = PluginManager()
    ids = {item.id for item in manager.get_plugins()}
    assert {
        "builtin:CsvFile", "builtin:OdcsFile", "builtin:DatabricksUnityCatalog",
        "builtin:AzureDataLake", "builtin:SQLServer",
    } <= ids, ids
    for manifest in manager.get_plugins():
        cls = manager.get_plugin(manifest.id)
        cls.get_connection_properties()
        cls.get_data_type_mappings()
    with tempfile.TemporaryDirectory() as directory:
        file = Path(directory) / "local.parquet"
        pq.write_table(pa.table({"value": [1, 2]}), file)
        assert pl.read_parquet(file)["value"].to_list() == [1, 2]
    print(json.dumps({"python": sys.version.split()[0], "datam8": version("datam8"), "plugins": sorted(ids)}))


def prepare_sources(solution_file):
    from datam8.plugins.builtins.file import CsvFile
    from datam8.plugins.builtins.odcs import OdcsFile

    root = solution_file.parent
    solution = json.loads(solution_file.read_text(encoding="utf-8"))
    base = root / solution["basePath"]
    data = root / "Local data"
    data.mkdir()
    (data / "orders.csv").write_text("id,name\n1,Müller\n2,Weiß\n", encoding="utf-8")
    write_json(data / "contract.json", {
        "apiVersion": "v3.2.0", "kind": "DataContract", "version": "1.0.0", "id": "runtime-fixture",
        "schema": [{"name": "customers", "properties": [
            {"name": "id", "logicalType": "integer"}, {"name": "name", "logicalType": "string"},
        ]}],
    })
    classes = (CsvFile, OdcsFile)
    types = sorted({"int"} | {mapping.targetType for cls in classes for mapping in cls.get_data_type_mappings()})
    write_json(base / "DataTypes.json", {"type": "dataTypes", "dataTypes": [
        {"name": name, "targets": {"test": name}, "hasCharLen": name in {"string", "binary"},
         "hasPrecision": name == "decimal", "hasScale": name == "decimal"} for name in types
    ]})
    write_json(base / "AttributeTypes.json", {"type": "attributeTypes", "attributeTypes": [
        {"name": "ID", "displayName": "Identifier", "defaultType": "int"},
        *[{"name": "Default" + name, "displayName": name, "defaultType": name, "isDefaultProperty": True} for name in types],
    ]})
    write_json(base / "DataSourceTypes.json", {"type": "dataSourceTypes", "dataSourceTypes": [
        {"name": cls.__name__, "pluginId": cls.manifest().id,
         "authModes": [item.to_dict() for item in cls.get_auth_modes()],
         "connectionProperties": [item.to_dict() for item in cls.get_connection_properties()],
         "dataTypeMapping": [item.to_dict() for item in cls.get_data_type_mappings()]} for cls in classes
    ]})
    write_json(base / "DataSources.json", {"type": "dataSources", "dataSources": [
        {"name": "Csv", "type": "CsvFile", "extendedProperties": {"path": str(data), "authMode": "no_auth"}},
        {"name": "Odcs", "type": "OdcsFile", "extendedProperties": {"path": str(data / "contract.json")}},
    ]})


def secret_check(solution_file, roundtrip, encrypted=False):
    import keyring
    from keyring.backends.fail import Keyring as Failed
    from datam8 import config
    from datam8.secrets import SecretResolver

    if roundtrip and (encrypted or sys.platform == "linux"):
        # Always test crypto after removing SelfTest, without touching user keyrings.
        from keyrings.cryptfile.cryptfile import CryptFileKeyring
        backend = CryptFileKeyring()
        backend.file_path = str(solution_file.parent / "test-keyring.cfg")
        backend.keyring_key = secrets.token_hex(24)
        keyring.set_keyring(backend)
    backend = keyring.get_keyring()
    assert not isinstance(backend, Failed), "No available secret backend"
    print(f"Secret backend: {type(backend).__module__}.{type(backend).__name__}")
    if not roundtrip:
        return
    # A unique solution name isolates both the secret and its registry entry.
    private = solution_file.parent / ("RuntimeSecret" + secrets.token_hex(12) + ".dm8s")
    private.write_bytes(solution_file.read_bytes())
    config.set_solution(private)
    resolver = SecretResolver()
    try:
        resolver.set_secret("runtime/password", "test-value")
        assert resolver.get_secret("ref://runtime/password") == "test-value"
        resolver.set_secret("runtime/password", "replacement", force=True)
        assert resolver.get_secret("runtime/password") == "replacement"
        assert len(resolver.list_secrets()) == 1
        resolver.unset_secret("runtime/password")
        assert resolver.get_secret("runtime/password") is None
        assert resolver.list_secrets() == []
    finally:
        resolver.clean()
        private.unlink()


if __name__ == "__main__":
    root = Path(sys.argv[1]).resolve(strict=True)
    action = sys.argv[2] if len(sys.argv) > 2 else "resources"
    if action == "resources":
        resources(root)
    elif action == "prepare-sources":
        prepare_sources(Path(sys.argv[3]))
    elif action in {"secrets", "secrets-roundtrip", "encrypted-secrets-roundtrip"}:
        secret_check(Path(sys.argv[3]), action != "secrets", action == "encrypted-secrets-roundtrip")
    else:
        raise ValueError(f"Unknown runtime check: {action}")

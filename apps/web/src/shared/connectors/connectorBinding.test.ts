import { describe, expect, test } from "vitest";
import { clearConnectorBinding, decodeConnectorBinding, encodeConnectorBinding } from "./connectorBinding";

describe("connectorBinding", () => {
  test("decode: returns null when unbound", () => {
    expect(decodeConnectorBinding(undefined)).toBeNull();
    expect(decodeConnectorBinding([])).toBeNull();
    expect(decodeConnectorBinding([{ name: "host", required: true }])).toBeNull();
  });

  test("decode: id only", () => {
    expect(decodeConnectorBinding([{ name: "__connector.id=postgresql", required: true }])).toEqual({
      connectorId: "postgresql",
      connectorVersion: null,
    });
  });

  test("decode: id and version", () => {
    expect(
      decodeConnectorBinding([
        { name: "__connector.id=sqlserver", required: true },
        { name: "__connector.version=0.1.0", required: false },
      ]),
    ).toEqual({ connectorId: "sqlserver", connectorVersion: "0.1.0" });
  });

  test("decode: rejects multiple ids", () => {
    expect(() =>
      decodeConnectorBinding([
        { name: "__connector.id=a", required: true },
        { name: "__connector.id=b", required: true },
      ]),
    ).toThrow(/exactly one/i);
  });

  test("encode: overwrites reserved entries preserving others", () => {
    const out = encodeConnectorBinding({
      connectionProperties: [
        { name: "host", required: true },
        { name: "__connector.id=old", required: true },
        { name: "__connector.version=>=0.1.0", required: false },
      ],
      connectorId: "new",
      connectorVersion: "0.2.0",
    });
    const names = out.map((p) => p.name);
    expect(names).toContain("host");
    expect(names).toContain("__connector.id=new");
    expect(names).toContain("__connector.version=0.2.0");
    expect(names).not.toContain("__connector.id=old");
  });

  test("clear: removes reserved entries preserving others", () => {
    const out = clearConnectorBinding([
      { name: "host", required: true },
      { name: "__connector.id=sqlserver", required: true },
      { name: "__connector.version=0.1.0", required: false },
    ]);
    const names = out.map((p) => p.name);
    expect(names).toEqual(["host"]);
  });
});

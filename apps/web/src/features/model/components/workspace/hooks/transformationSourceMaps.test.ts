import { describe, expect, it } from "vitest";
import { reindexRecordAfterMove, reindexRecordAfterRemove } from "./transformationSourceMaps";

describe("transformationSourceMaps", () => {
  it("reindexes entries after removing one transformation", () => {
    const result = reindexRecordAfterRemove(
      {
        0: "step0",
        1: "step1",
        3: "step3",
      },
      1,
    );

    expect(result).toEqual({
      0: "step0",
      2: "step3",
    });
  });

  it("moves record indices forward on reorder", () => {
    const result = reindexRecordAfterMove(
      {
        0: "a",
        1: "b",
        2: "c",
        3: "d",
      },
      1,
      3,
    );

    expect(result).toEqual({
      0: "a",
      1: "c",
      2: "d",
      3: "b",
    });
  });

  it("moves record indices backward on reorder", () => {
    const result = reindexRecordAfterMove(
      {
        0: "a",
        1: "b",
        2: "c",
        3: "d",
      },
      3,
      1,
    );

    expect(result).toEqual({
      0: "a",
      1: "d",
      2: "b",
      3: "c",
    });
  });
});

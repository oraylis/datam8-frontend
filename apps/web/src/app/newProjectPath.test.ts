import { describe, expect, it } from "vitest";
import { deriveNewProjectRequestPath } from "./newProjectPath";

describe("deriveNewProjectRequestPath", () => {
  it("derives solutionName and projectRoot from unix-like paths", () => {
    const result = deriveNewProjectRequestPath("/workspace/projects/MySolution.dm8s", "");
    expect(result).toEqual({
      solutionName: "MySolution",
      projectRoot: "/workspace/projects",
    });
  });

  it("derives solutionName and projectRoot from windows paths", () => {
    const result = deriveNewProjectRequestPath("C:\\Users\\dev\\Projects\\MySolution.dm8s", "");
    expect(result).toEqual({
      solutionName: "MySolution",
      projectRoot: "C:\\Users\\dev\\Projects",
    });
  });

  it("keeps drive-root paths valid on windows", () => {
    const result = deriveNewProjectRequestPath("C:\\MySolution.dm8s", "");
    expect(result).toEqual({
      solutionName: "MySolution",
      projectRoot: "C:\\",
    });
  });

  it("prefers explicit solutionName", () => {
    const result = deriveNewProjectRequestPath("C:\\Users\\dev\\Projects\\MySolution.dm8s", "ChosenByUser");
    expect(result).toEqual({
      solutionName: "ChosenByUser",
      projectRoot: "C:\\Users\\dev\\Projects",
    });
  });
});

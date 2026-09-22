export type NewProjectRequestPath = {
  solutionName: string;
  projectRoot: string;
};

export function deriveNewProjectRequestPath(filePath: string, preferredSolutionName: string): NewProjectRequestPath {
  const trimmedPath = filePath.trim();
  const lastForwardSlash = trimmedPath.lastIndexOf("/");
  const lastBackwardSlash = trimmedPath.lastIndexOf("\\");
  const separatorIndex = Math.max(lastForwardSlash, lastBackwardSlash);
  const separator = separatorIndex >= 0 ? trimmedPath[separatorIndex] : "";

  const fileName = separatorIndex >= 0 ? trimmedPath.slice(separatorIndex + 1) : trimmedPath;
  let projectRoot =
    separatorIndex < 0 ? "" : separatorIndex === 0 ? separator : trimmedPath.slice(0, separatorIndex);

  if (/^[A-Za-z]:$/.test(projectRoot) && separator) {
    // Keep drive-root paths valid (for example "C:\").
    projectRoot = `${projectRoot}${separator}`;
  }

  const normalizedPreferredName = preferredSolutionName.trim();
  const solutionName = normalizedPreferredName || fileName.replace(/\.dm8s$/i, "") || "NewSolution";

  return {
    solutionName,
    projectRoot,
  };
}

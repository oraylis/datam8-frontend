export class V1SolutionDetectedError extends Error {
  code = "SOLUTION_V1" as const;
  sourceSolutionPath: string;

  constructor(sourceSolutionPath: string) {
    super("V1 solution detected");
    this.sourceSolutionPath = sourceSolutionPath;
  }
}


import { describe, expect, it } from "vitest";
import { pruneConnectionPropertiesForConnector } from "./dataSourceConnectionProperties";

describe("pruneConnectionPropertiesForConnector", () => {
  it("keeps only properties supported by the newly linked connector", () => {
    expect(
      pruneConnectionPropertiesForConnector(
        {
          authMode: "bitbucket_server_bearer_token",
          bitbucket_base_url: "https://bitbucket.united-internet.org/rest/api/1.0",
          project_key: "DATAB",
          repo_slug: "data-platform-shared",
          bearer_token: "ref://datasources/telecom/bearer_token",
          port: 1433,
          encrypt: true,
        },
        [
          { name: "authMode" },
          { name: "bitbucket_base_url" },
          { name: "project_key" },
          { name: "repo_slug" },
          { name: "bearer_token" },
        ],
      ),
    ).toEqual({
      authMode: "bitbucket_server_bearer_token",
      bitbucket_base_url: "https://bitbucket.united-internet.org/rest/api/1.0",
      project_key: "DATAB",
      repo_slug: "data-platform-shared",
      bearer_token: "ref://datasources/telecom/bearer_token",
    });
  });
});

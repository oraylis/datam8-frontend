import { expect, test } from "@playwright/test";

const saveDir = "/tmp/projects";
const solutionName = "NewProject";
const solutionPath = `${saveDir}/${solutionName}.dm8s`;

type ProjectInputs = { saveDir: string; solutionName: string };
type ProjectWindow = Window & {
  createTestProject: (inputs: ProjectInputs) => Promise<{ solutionPath: string }>;
  loadTestProject: (path: string) => Promise<unknown>;
  desktop?: unknown;
};

test.beforeEach(async ({ page }) => {
  await page.route("**/config", (route) => route.fulfill({ json: { mode: "electron" } }));
  await page.route("**/plugins", (route) => route.fulfill({ json: { items: [] } }));
  await page.addInitScript((directory) => {
    const browser = window as ProjectWindow;
    browser.desktop = {
      isElectron: true,
      apiBase: window.location.origin,
      solution: {
        pickDirectory: async () => directory,
        createNew: (inputs: ProjectInputs) => browser.createTestProject(inputs),
        load: (path: string) => browser.loadTestProject(path),
      },
    };
  }, saveDir);
  await page.goto("/");
  await page.getByRole("button", { name: "New", exact: true }).click();
});

test("creates and opens a project in the chosen directory", async ({ page }) => {
  const created: ProjectInputs[] = [];
  const loaded: string[] = [];
  await page.exposeFunction("createTestProject", (inputs: ProjectInputs) => {
    created.push(inputs);
    return { solutionPath };
  });
  await page.exposeFunction("loadTestProject", (path: string) => {
    loaded.push(path);
    return {
      path,
      workspaceId: "created-project",
      payload: { solution: { schemaVersion: "2.0.0", basePath: "Base", modelPath: "Model" } },
    };
  });

  const dialog = page.getByRole("dialog", { name: "Create New Project" });
  const create = dialog.getByRole("button", { name: "Create Solution" });
  await expect(dialog.getByLabel(/Base Folder|Model Folder|Template ZIP/)).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Add Target" })).toHaveCount(0);
  await expect(create).toBeDisabled();
  await dialog.getByLabel("Solution Name").fill(solutionName);
  await expect(create).toBeDisabled();
  await dialog.getByRole("button", { name: "Browse" }).click();
  await expect(dialog.getByText(`Creates ${solutionPath}.`)).toBeVisible();
  await create.click();

  await expect(dialog).toBeHidden();
  expect(created).toEqual([{ saveDir, solutionName }]);
  expect(loaded).toEqual([solutionPath]);
});

test("outside clicks preserve a project draft and Cancel closes the dialog", async ({ page }) => {
  const dialog = page.getByRole("dialog", { name: "Create New Project" });
  const name = dialog.getByLabel("Solution Name");
  await name.fill("Draft");
  await page.mouse.click(10, 10);
  await expect(name).toHaveValue("Draft");

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
});

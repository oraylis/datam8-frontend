import { expect, test } from "@playwright/test";

const solutionPath = (process.env.DATAM8_RELEASE_SOLUTION_PATH || "").trim();

async function openSolution(page: import("@playwright/test").Page, dm8sPath: string) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const pathInput = page.getByPlaceholder("Absolute path to .dm8s");
  if (!(await pathInput.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Open" }).first().click();
    await expect(pathInput).toBeVisible();
  }

  await pathInput.fill(dm8sPath);
  await page.getByRole("button", { name: "Load" }).click();
  await expect(page.getByText("Select solution (.dm8s)")).toBeHidden();
  await expect(page.getByRole("textbox", { name: "Filter model entities" })).toBeVisible();
}

test.describe.serial("release folder rename (real sample)", () => {
  test.skip(!solutionPath, "Set DATAM8_RELEASE_SOLUTION_PATH to run release tests.");

  test("folder rename apply action uses /entities/move and succeeds", async ({ page }) => {
    const moveBodies: Array<{ from?: string; to?: string }> = [];
    const moveStatuses: number[] = [];

    page.on("response", async (response) => {
      if (!response.url().includes("/entities/move")) return;
      const request = response.request();
      if (request.method() !== "POST") return;
      moveStatuses.push(response.status());
      try {
        moveBodies.push(JSON.parse(request.postData() || "{}"));
      } catch {
        moveBodies.push({});
      }
    });

    await openSolution(page, solutionPath);

    await page.getByRole("button", { name: "020-Core" }).first().click();
    await page.getByRole("button", { name: "Sales" }).first().click();

    await expect(page.getByText("Folder Name")).toBeVisible();
    const folderNameInput = page.locator('label:has-text("Folder Name") + input').first();
    const renamed = `SalesE2E_${Date.now().toString().slice(-4)}`;
    await folderNameInput.fill(renamed);
    await folderNameInput.press("Tab");

    await expect(page.getByRole("heading", { name: "Apply actions" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /Apply 1 Action\(s\)/ }).click();

    await expect.poll(() => moveBodies.length, { timeout: 20_000 }).toBeGreaterThan(0);
    expect(moveBodies[0]?.from?.startsWith("/folders/")).toBeTruthy();
    expect(moveBodies[0]?.to?.startsWith("/folders/")).toBeTruthy();
    expect(moveBodies[0]?.to?.endsWith(`/${renamed}`)).toBeTruthy();
    expect(moveStatuses[0]).toBeLessThan(400);

    await expect(page.getByRole("heading", { name: "Apply actions" })).toHaveCount(0);
    await expect(page.getByText("Apply action failed")).toHaveCount(0);
    await expect(page.getByRole("button", { name: renamed }).first()).toBeVisible();
  });
});

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: validator-run.spec.ts >> Validator Run reports the pinned Generator API gap without a /validate request
- Location: e2e\validator-run.spec.ts:78:1

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('menuitem', { name: 'Validate only' })

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e4]:
    - complementary [ref=e5]:
      - generic [ref=e6]:
        - generic [ref=e7]:
          - generic [ref=e8]:
            - generic "DataM8" [ref=e9]:
              - img "DataM8" [ref=e10]
            - button "Hide navigation" [ref=e11] [cursor=pointer]:
              - img [ref=e12]
          - generic "Primary actions" [ref=e14]:
            - button "New" [ref=e15]:
              - img [ref=e16]
              - generic [ref=e19]: New
            - button "Open" [ref=e20]:
              - img [ref=e21]
              - generic [ref=e23]: Open
            - button "Reload" [ref=e24]:
              - img [ref=e25]
              - generic [ref=e30]: Reload
            - button "Add Entity" [ref=e31]:
              - img [ref=e32]
              - generic [ref=e33]: Add Entity
          - generic [ref=e34]:
            - generic:
              - img
              - generic: Filter model...
            - textbox "Filter model entities" [ref=e35]:
              - /placeholder: ""
          - tablist "Navigation scope" [ref=e36]:
            - tab "Model" [selected] [ref=e37] [cursor=pointer]
            - tab "Base" [ref=e38] [cursor=pointer]
        - generic [ref=e42]: No entities loaded
        - button "Switch to dark theme" [ref=e44] [cursor=pointer]:
          - img [ref=e45]
    - generic [ref=e48]:
      - generic [ref=e53]:
        - button "Close all tabs" [disabled] [ref=e54]: ×
        - generic "Run actions" [ref=e56]:
          - button "Refresh schemas" [ref=e57] [cursor=pointer]:
            - img [ref=e58]
          - button "Toggle generator" [ref=e63] [cursor=pointer]:
            - img [ref=e64]
      - generic [ref=e69]:
        - generic [ref=e70]: No tab open
        - generic [ref=e71]: Select an entity or base entry from the sidebar to begin.
      - generic:
        - generic:
          - generic:
            - generic:
              - generic:
                - generic:
                  - combobox:
                    - generic: default
                    - img
                  - combobox:
                    - generic: info
                    - img
                  - generic:
                    - button "Generate":
                      - img
                      - text: Generate
                    - button "More generator actions":
                      - img
                - button "Close generator panel":
                  - img
            - generic:
              - generic:
                - generic: No logs yet.
  - region "Notifications (F8)":
    - list
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | function createMockSolutionPayload() {
  4  |   return {
  5  |     solution: {
  6  |       schemaVersion: "test",
  7  |       basePath: "Base",
  8  |       modelPath: "Model",
  9  |       pluginsPath: "plugins",
  10 |       generatorTargets: [{ name: "default", isDefault: true, sourcePath: "Generate", outputPath: "Output" }],
  11 |     },
  12 |     baseEntities: [],
  13 |     modelEntities: [],
  14 |   };
  15 | }
  16 | 
  17 | async function mockApi(page: import("@playwright/test").Page) {
  18 |   const payload = createMockSolutionPayload();
  19 |   let validateCalls = 0;
  20 | 
  21 |   await page.route("**/config", async (route) => {
  22 |     await route.fulfill({ json: { mode: "server" } });
  23 |   });
  24 |   await page.route("**/model/save", async (route) => {
  25 |     await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  26 |   });
  27 | 
  28 |   await page.route("**/solution/inspect**", async (route) => {
  29 |     await route.fulfill({ json: { version: "v2" } });
  30 |   });
  31 | 
  32 |   await page.route("**/solution/full**", async (route) => {
  33 |     await route.fulfill({ json: payload });
  34 |   });
  35 | 
  36 |   await page.route("**/fs/list**", async (route) => {
  37 |     await route.fulfill({ json: { entries: [] } });
  38 |   });
  39 | 
  40 |   await page.route("**/plugins/**", async (route) => {
  41 |     const method = route.request().method();
  42 |     if (method === "GET" || method === "POST") {
  43 |       await route.fulfill({ json: { items: [] } });
  44 |       return;
  45 |     }
  46 |     await route.fulfill({ status: 405, json: { error: "method not allowed" } });
  47 |   });
  48 | 
  49 |   await page.route("**/secrets/available", async (route) => {
  50 |     await route.fulfill({ json: { available: false } });
  51 |   });
  52 | 
  53 |   await page.route("**/secrets/runtime**", async (route) => {
  54 |     if (route.request().method() === "GET") {
  55 |       await route.fulfill({ json: { runtimeSecrets: null } });
  56 |       return;
  57 |     }
  58 |     await route.fulfill({ json: {} });
  59 |   });
  60 | 
  61 |   await page.route("**/validate**", async (route) => {
  62 |     validateCalls += 1;
  63 |     await route.fulfill({ status: 404, json: { detail: "Not Found" } });
  64 |   });
  65 | 
  66 |   return {
  67 |     getValidateCalls: () => validateCalls,
  68 |   };
  69 | }
  70 | 
  71 | async function loadSolutionFromDialog(page: import("@playwright/test").Page) {
  72 |   await page.goto("/", { waitUntil: "domcontentloaded" });
  73 |   await page.getByPlaceholder("Absolute path to .dm8s").fill("/tmp/mock.dm8s");
  74 |   await page.getByRole("button", { name: "Load" }).click();
  75 |   await expect(page.getByText("Select solution (.dm8s)")).toBeHidden();
  76 | }
  77 | 
  78 | test("Validator Run reports the pinned Generator API gap without a /validate request", async ({ page }) => {
  79 |   const { getValidateCalls } = await mockApi(page);
  80 |   await loadSolutionFromDialog(page);
  81 | 
  82 |   const validatorPanel = page.locator(".generator-drawer").first();
  83 |   const validatorRunButton = validatorPanel.getByRole("button", { name: "More generator actions" }).first();
  84 |   await expect(validatorRunButton).toBeVisible();
  85 |   await expect(validatorRunButton).toBeEnabled();
  86 | 
  87 |   await validatorRunButton.evaluate((element) => (element as HTMLButtonElement).click());
> 88 |   await page.getByRole("menuitem", { name: "Validate only" }).click();
     |                                                               ^ Error: locator.click: Test timeout of 60000ms exceeded.
  89 | 
  90 |   await expect.poll(getValidateCalls, { timeout: 5_000 }).toBe(0);
  91 |   await expect(page.getByText("Validate is not available in the pinned Generator API.")).toBeVisible();
  92 | });
  93 | 
```
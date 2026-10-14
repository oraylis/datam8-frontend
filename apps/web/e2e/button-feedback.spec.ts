import { expect, test, type Locator, type Page } from "@playwright/test";

async function openFixture(page: Page, theme: "light" | "dark") {
  await page.route("**/__button-feedback**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><body style="margin:0"><div id="root"></div><script type="module">
    import RefreshRuntime from '/@react-refresh';
    RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {};
    window.$RefreshSig$ = () => (type) => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    await import('/e2e/fixtures/button-feedback.tsx');
  </script></body></html>`,
    }),
  );
  await page.goto(`/__button-feedback?theme=${theme}`);
  await expect(
    page.getByRole("button", { name: "Outline", exact: true }),
  ).toBeVisible();
}

async function styles(button: Locator) {
  return button.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      overlay: style.getPropertyValue("--ui-button-overlay"),
      transform: style.transform,
      border: style.borderTopColor,
      outline: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      duration: style.transitionDuration,
    };
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: shared variants and legacy buttons have visible hover and pressed feedback`, async ({
    page,
  }) => {
    await openFixture(page, theme);
    const names = [
      "Primary",
      "Secondary",
      "Utility",
      "Outline",
      "Ghost",
      "Subtle",
      "Destructive",
      "Link",
      "Sidebar",
      "Shared icon",
      "Action wrapper",
      "Legacy",
      "Legacy primary",
      "Legacy ghost",
      "Legacy icon",
      "Selected icon",
    ];
    for (const name of names) {
      await page.mouse.move(0, 0);
      const button = page.getByRole("button", { name, exact: true });
      await expect
        .poll(async () => (await styles(button)).overlay)
        .toMatch(/(?:rgba\(0, 0, 0, 0\)|transparent|\/ 0\))/);
      const idle = await button.screenshot();
      const idleBox = (await button.boundingBox())!;
      const idleStyle = await styles(button);
      await button.hover();
      await expect
        .poll(async () => (await styles(button)).overlay)
        .toContain("0.06");
      const hovered = await button.screenshot();
      expect(hovered.equals(idle), `${name} must visibly change on hover`).toBe(
        false,
      );
      const hoverBox = (await button.boundingBox())!;
      expect(hoverBox.width).toBe(idleBox.width);
      expect(hoverBox.height).toBe(idleBox.height);
      expect((await styles(button)).border).not.toBe(idleStyle.border);
      await page.mouse.down();
      await expect
        .poll(async () => (await styles(button)).overlay)
        .toContain("0.12");
      await expect
        .poll(async () => (await styles(button)).transform)
        .toBe("matrix(1, 0, 0, 1, 0, 1)");
      const pressedBox = (await button.boundingBox())!;
      expect(pressedBox.y - idleBox.y).toBeCloseTo(1, 1);
      expect(pressedBox.width).toBe(idleBox.width);
      expect(pressedBox.height).toBe(idleBox.height);
      const pressed = await button.screenshot();
      expect(
        pressed.equals(hovered),
        `${name} must visibly change while held`,
      ).toBe(false);
      expect((await styles(button)).duration).toBe("0s");
      await page.mouse.up();
      await expect
        .poll(async () => (await styles(button)).overlay)
        .toContain("0.06");
      await expect
        .poll(async () => (await styles(button)).transform)
        .toBe("none");
    }
    await expect(
      page.getByRole("button", { name: "Selected icon" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: "Selected icon" }),
    ).toHaveClass(/icon-btn--active/);
  });

  test(`${theme}: disabled buttons stay inert and keyboard focus is visible`, async ({
    page,
  }) => {
    await openFixture(page, theme);
    for (const name of [
      "Disabled",
      "Legacy disabled",
      "Legacy disabled icon",
      "ARIA disabled",
    ]) {
      const button =
        name === "ARIA disabled"
          ? page.getByRole("link", { name })
          : page.getByRole("button", { name, exact: true });
      const before = await styles(button);
      const box = (await button.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      expect(await styles(button)).toEqual(before);
      await page.mouse.up();
    }
    await page.mouse.move(0, 0);
    await page.getByRole("button", { name: "Primary", exact: true }).focus();
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    await expect(focused).toHaveClass(/ui-button/);
    await expect
      .poll(async () => (await styles(focused)).outline)
      .toBe("solid");
    expect((await styles(focused)).outlineWidth).toBe("2px");
    await page
      .getByRole("button", { name: "Legacy ghost", exact: true })
      .focus();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Legacy icon", exact: true }),
    ).toBeFocused();
    expect((await styles(page.locator(":focus"))).outlineWidth).toBe("2px");
  });

  test(`${theme}: reduced motion keeps color feedback without movement or transitions`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openFixture(page, theme);
    for (const name of ["Outline", "Primary", "Legacy", "Legacy icon"]) {
      const button = page.getByRole("button", { name, exact: true });
      await button.hover();
      expect((await styles(button)).overlay).toContain("0.06");
      expect((await styles(button)).duration).toBe("0s");
      const idleBox = (await button.boundingBox())!;
      await page.mouse.down();
      expect((await styles(button)).overlay).toContain("0.12");
      expect((await styles(button)).transform).toBe("none");
      expect((await button.boundingBox())!.y).toBe(idleBox.y);
      await page.mouse.up();
    }
  });

  test(`${theme}: Cancel and Back have consistent feedback in dialogs and still close them`, async ({
    page,
  }) => {
    await openFixture(page, theme);
    for (const name of ["Cancel", "Back"]) {
      await page
        .getByRole("button", {
          name: `Open ${name.toLowerCase()} dialog`,
          exact: true,
        })
        .click();
      const dialog = page.getByRole("dialog");
      const button = dialog.getByRole("button", { name, exact: true });
      await page.mouse.move(0, 0);
      await dialog.screenshot({
        path: `output/playwright/button-feedback-${theme}-${name.toLowerCase()}-idle.png`,
      });
      await button.hover();
      await expect
        .poll(async () => (await styles(button)).overlay)
        .toContain("0.06");
      await dialog.screenshot({
        path: `output/playwright/button-feedback-${theme}-${name.toLowerCase()}-hover.png`,
      });
      const dialogBox = await dialog.boundingBox();
      await page.mouse.down();
      await expect
        .poll(async () => (await styles(button)).overlay)
        .toContain("0.12");
      expect(await dialog.boundingBox()).toEqual(dialogBox);
      await dialog.screenshot({
        path: `output/playwright/button-feedback-${theme}-${name.toLowerCase()}-pressed.png`,
      });
      await page.mouse.up();
      await expect(dialog).toHaveCount(0);
    }
  });
}

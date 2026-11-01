import { test, expect } from "@playwright/test";
import { mockBackend } from "./fixtures";

for (const width of [1366, 1920]) {
  test(`page identity and a single workflow navigation fit all routes at ${width}px`, async ({
    page,
  }) => {
    await mockBackend(page);
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 1080 });
    await page.goto("/scan");
    const destinations = [
      {
        name: "数据采集与管理",
        title: "数据采集与管理",
        role: "link" as const,
      },
      { name: "AI焊缝识别", title: "AI焊缝识别", role: "button" as const },
      { name: "坐标标定", title: "坐标标定", role: "button" as const },
      { name: "焊缝管理", title: "焊缝管理", role: "button" as const },
      {
        name: "程序与预演",
        title: "程序生成与轨迹预演",
        role: "button" as const,
      },
      { name: "程序下发", title: "机器人程序下发", role: "button" as const },
    ];
    for (const [index, destination] of destinations.entries()) {
      const control = page
        .locator(".steps")
        .getByRole(destination.role, { name: destination.name, exact: true });
      await control.click();
      await expect(
        page.getByRole("heading", { name: destination.title, exact: true }),
      ).toBeVisible();
      await expect(control).toHaveAttribute("aria-current", "page");
      await expect(page.locator('.steps [aria-current="page"]')).toHaveCount(1);
      await expect(page.locator(".function-number")).toHaveText(
        String(index + 1).padStart(2, "0"),
      );
      await expect(page.locator(".function-purpose")).toBeVisible();
      await expect(page.locator(".steps > a, .steps > button")).toHaveCount(6);
      await expect(
        page.locator(".workflow-pager, .step-state, .step-warning"),
      ).toHaveCount(0);
      const geometry = await page.evaluate(() => {
        const heading = document
          .querySelector(".workspace-brand")!
          .getBoundingClientRect();
        const actions = document
          .querySelector(".workspace-actions")!
          .getBoundingClientRect();
        const nav = document.querySelector(".steps")!;
        return {
          overlap:
            heading.right > nav.getBoundingClientRect().left ||
            nav.getBoundingClientRect().right > actions.left,
          navAtTop: nav.getBoundingClientRect().top < 90,
          fontSize: parseFloat(
            getComputedStyle(document.querySelector("h1")!).fontSize,
          ),
          navOverflow: nav.scrollWidth > nav.clientWidth,
          pageOverflow: document.documentElement.scrollHeight > innerHeight,
        };
      });
      expect(geometry).toEqual({
        overlap: false,
        fontSize: width === 1366 ? 22 : 26,
        navAtTop: true,
        navOverflow: false,
        pageOverflow: false,
      });
    }
    await page
      .locator(".steps")
      .getByRole("button", { name: "AI焊缝识别", exact: true })
      .click();
    await page.screenshot({ path: `test-results/function-title-${width}.png` });
    await page.getByLabel("切换深浅主题").click();
    const selected = page.locator('.steps [aria-current="page"]');
    await expect(selected).toBeVisible();
    expect(
      await selected.evaluate((element) => getComputedStyle(element).color),
    ).toBe("rgb(255, 194, 154)");
  });
}

import { test, expect } from "@playwright/test";
import { mockBackend } from "./fixtures";
test("homepage info buttons open readable dialogs, close accessibly, and preserve the home layout", async ({
  page,
}) => {
  await mockBackend(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  const before = await page.locator(".home-hero").boundingBox();
  const architecture = page
    .locator(".site-header")
    .getByRole("button", { name: "技术架构", exact: true });
  await architecture.click();
  const dialog = page.getByRole("dialog", { name: "技术架构与部署说明" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("3000");
  await expect(dialog).toContainText("8000");
  await expect(dialog).toContainText("当前仓库提供前端");
  await expect(dialog.getByRole("button", { name: "知道了" })).toBeInViewport({
    ratio: 1,
  });
  await page.screenshot({
    path: "test-results/home-architecture-dialog.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(architecture).toBeFocused();
  expect(await page.locator(".home-hero").boundingBox()).toEqual(before);
  await page
    .locator(".site-header")
    .getByRole("button", { name: "关于系统", exact: true })
    .click();
  const about = page.getByRole("dialog", { name: "关于焊缝识别系统" });
  await expect(about).toContainText("只生成与传输文件，不启动机器人");
  await expect(about).toContainText("合成数据");
  await about.getByRole("button", { name: "关闭说明" }).click();
  await expect(about).not.toBeVisible();
  await page
    .locator(".home-footer")
    .getByRole("button", { name: "技术架构与部署说明", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "技术架构与部署说明" }),
  ).toBeVisible();
  await page
    .getByRole("dialog", { name: "技术架构与部署说明" })
    .getByRole("button", { name: "知道了" })
    .click();
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight),
  ).toBeLessThanOrEqual(768);
  await page
    .locator(".site-header")
    .getByRole("button", { name: "关于系统", exact: true })
    .click();
  await page.mouse.click(5, 5);
  await expect(
    page.getByRole("dialog", { name: "关于焊缝识别系统" }),
  ).toHaveCount(0);
});

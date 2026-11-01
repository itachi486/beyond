import { describe, it, expect } from "vitest";
import {
  adminLocale,
  adminMessages,
  t,
  adminNumber,
  adminDate,
} from "../admin/i18n";
describe("isolated administrator English catalog", () => {
  it("has English UI keys and stable number/date formatting without changing public storage", () => {
    expect(adminLocale).toBe("en");
    expect(t("dashboard")).toBe("Dashboard");
    expect(t("deleteConfirm")).toBe("Delete Permanently");
    expect(adminNumber(12345)).toBe("12,345");
    expect(adminDate("2026-10-28T09:42:00Z")).toContain("UTC");
    expect(adminDate("invalid")).toBe("Unavailable");
    for (const value of Object.values(adminMessages)) {
      expect(value.trim()).not.toBe("");
      expect(value).not.toMatch(/[가-힣]/);
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  AGPL_LICENSE_URL,
  ASSET_CREDITS_URL,
  OPENFRONT_IO_URL,
  SOURCE_REPO_URL,
} from "../../src/client/Attribution";

describe("Attribution URLs", () => {
  it("points public source, license, and credits at claiming-cosmos", () => {
    expect(SOURCE_REPO_URL).toBe(
      "https://github.com/DigitalGoliath2024/claiming-cosmos",
    );
    expect(AGPL_LICENSE_URL).toBe(
      "https://github.com/DigitalGoliath2024/claiming-cosmos/blob/main/LICENSE",
    );
    expect(ASSET_CREDITS_URL).toBe(
      "https://github.com/DigitalGoliath2024/claiming-cosmos/blob/main/CREDITS.md",
    );
    expect(SOURCE_REPO_URL).not.toContain("Ancientfront");
    expect(OPENFRONT_IO_URL).toBe("https://openfront.io/");
  });
});

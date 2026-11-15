import { describe, expect, it } from "vitest";
import { uuidOrNull } from "../src/riot/Uuid.js";

describe("uuidOrNull", () => {
  it("treats Riot's all-zero uuid as none", () => {
    expect(uuidOrNull("00000000-0000-0000-0000-000000000000")).toBeNull();
    expect(uuidOrNull("0000")).toBeNull();
  });

  it("is null for anything that is not a non-empty string", () => {
    expect(uuidOrNull("")).toBeNull();
    expect(uuidOrNull(7)).toBeNull();
    expect(uuidOrNull(undefined)).toBeNull();
  });

  it("passes a real uuid through", () => {
    expect(uuidOrNull("a1b2")).toBe("a1b2");
  });
});

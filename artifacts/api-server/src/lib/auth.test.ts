import { describe, it, expect } from "vitest";
import {
  hashPassword,
  comparePassword,
  generateLoginCode,
} from "../lib/auth";

describe("hashPassword", () => {
  it("returns a non-empty string", async () => {
    const hash = await hashPassword("mySecret");
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("includes a dot separator between hash and salt", async () => {
    const hash = await hashPassword("password123");
    expect(hash).toContain(".");
  });

  it("produces different hashes for the same password (random salt)", async () => {
    const hash1 = await hashPassword("samePassword");
    const hash2 = await hashPassword("samePassword");
    expect(hash1).not.toBe(hash2);
  });
});

describe("comparePassword", () => {
  it("returns true for a correct password", async () => {
    const password = "correct-horse-battery-staple";
    const hash = await hashPassword(password);
    const result = await comparePassword(password, hash);
    expect(result).toBe(true);
  });

  it("returns false for an incorrect password", async () => {
    const hash = await hashPassword("realPassword");
    const result = await comparePassword("wrongPassword", hash);
    expect(result).toBe(false);
  });

  it("returns false when hash has no dot separator", async () => {
    const result = await comparePassword("password", "invaliddhashthatnodot");
    expect(result).toBe(false);
  });

  it("returns false when salt part is missing", async () => {
    const result = await comparePassword("password", ".nohashpart");
    expect(result).toBe(false);
  });

  it("returns false when hash part is missing", async () => {
    const result = await comparePassword("password", "nohashpart.");
    expect(result).toBe(false);
  });

  it("is case-sensitive for passwords", async () => {
    const hash = await hashPassword("Password");
    const result = await comparePassword("password", hash);
    expect(result).toBe(false);
  });
});

describe("generateLoginCode", () => {
  it("generates a code of default length 8", () => {
    const code = generateLoginCode();
    expect(code.length).toBe(8);
  });

  it("generates a code of specified length", () => {
    const code = generateLoginCode(12);
    expect(code.length).toBe(12);
  });

  it("generates a code with only valid characters", () => {
    const validChars = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/;
    for (let i = 0; i < 50; i++) {
      const code = generateLoginCode();
      expect(code).toMatch(validChars);
    }
  });

  it("generates different codes on successive calls (randomness check)", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateLoginCode()));
    expect(codes.size).toBeGreaterThan(1);
  });

  it("does not include ambiguous characters (0, O, 1, I)", () => {
    const ambiguous = /[0O1I]/;
    for (let i = 0; i < 100; i++) {
      expect(generateLoginCode()).not.toMatch(ambiguous);
    }
  });
});

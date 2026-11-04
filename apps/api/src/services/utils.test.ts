import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPasswordDetails } from "./utils";

const legacyHash = (password: string) =>
	createHash("sha256").update(`${password}salt`).digest("hex");

describe("password hashing utils", () => {
	it("produces scrypt$<32-hex salt>$<128-hex key> hashes that verify", async () => {
		const hash = await hashPassword("correct horse");

		expect(hash).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
		await expect(verifyPasswordDetails("correct horse", hash)).resolves.toEqual({
			valid: true,
			isLegacy: false,
		});
		await expect(verifyPasswordDetails("wrong", hash)).resolves.toEqual({
			valid: false,
			isLegacy: false,
		});
	});

	it("verifies legacy SHA-256 hashes and flags them for upgrade", async () => {
		await expect(verifyPasswordDetails("password123", legacyHash("password123"))).resolves.toEqual({
			valid: true,
			isLegacy: true,
		});
		await expect(verifyPasswordDetails("nope", legacyHash("password123"))).resolves.toEqual({
			valid: false,
			isLegacy: false,
		});
	});

	it("rejects malformed / different-length stored hashes without throwing", async () => {
		// timingSafeEqual throws on unequal lengths; the length guard must short-circuit first.
		await expect(verifyPasswordDetails("password123", "short")).resolves.toEqual({
			valid: false,
			isLegacy: false,
		});
		await expect(verifyPasswordDetails("password123", "scrypt$abc$00")).resolves.toEqual({
			valid: false,
			isLegacy: false,
		});
		await expect(verifyPasswordDetails("password123", "scrypt$broken")).resolves.toEqual({
			valid: false,
			isLegacy: false,
		});
	});
});

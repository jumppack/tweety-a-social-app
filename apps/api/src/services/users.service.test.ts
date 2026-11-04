import { describe, expect, it } from "vitest";
import { createTestFollow, createTestUser } from "../../tests/helpers";
import { getUser, updateProfile } from "./users.service";

/**
 */
describe("UsersService", () => {
	describe("getUser", () => {
		it("returns user profile with correct follower and following counts", async () => {
			const u1 = await createTestUser({ username: "u1" });
			const u2 = await createTestUser({ username: "u2" });

			await createTestFollow(u2.id, u1.id); // u2 follows u1

			const profile1 = await getUser("u1", u2.id);
			expect(profile1.username).toBe("u1");
			expect(profile1.followerCount).toBe(1);
			expect(profile1.isFollowing).toBe(true);

			const profile2 = await getUser("u2", u1.id);
			expect(profile2.followingCount).toBe(1);
			expect(profile2.isFollowing).toBe(false);
		});

		it("throws for non-existent username", async () => {
			await expect(getUser("nonexistent_user_12345")).rejects.toThrow("User not found");
		});
	});

	describe("updateProfile", () => {
		it("updates user bio and display name", async () => {
			const user = await createTestUser({ displayName: "Original Name", bio: "Original bio" });

			const result = await updateProfile({
				userId: user.id,
				displayName: "New Display Name",
				bio: "New updated bio",
			});

			expect(result.success).toBe(true);

			const profile = await getUser(user.username);
			expect(profile.displayName).toBe("New Display Name");
			expect(profile.bio).toBe("New updated bio");
		});
	});
});

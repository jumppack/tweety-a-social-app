import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock the server functions
vi.mock("../../../src/server/functions/likes", () => ({
	toggleCommentLike: vi.fn(),
}));

vi.mock("../../../src/server/functions/comments", () => ({
	deleteComment: vi.fn(),
}));

vi.mock("../../../src/server/functions/reports", () => ({
	reportContent: vi.fn(),
}));

// Mock TanStack Router Link component
vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
		<a href={to}>{children}</a>
	),
}));

const mockComment = {
	id: "comment1",
	content: "Test comment content",
	createdAt: new Date("2024-01-01T10:00:00Z"),
	author: {
		id: "user1",
		username: "testuser",
		displayName: "Test User",
		avatarUrl: null,
	},
};

describe("CommentCard", () => {
	it("renders comment content correctly", async () => {
		const { CommentCard } = await import("../../../src/components/comments/CommentCard");
		render(<CommentCard comment={mockComment} />);
		expect(screen.getByText("Test comment content")).toBeInTheDocument();
		expect(screen.getByText("Test User")).toBeInTheDocument();
	});

	it("shows like button", async () => {
		const { CommentCard } = await import("../../../src/components/comments/CommentCard");
		render(<CommentCard comment={mockComment} />);
		const buttons = screen.getAllByRole("button");
		// Should have at least the like button
		expect(buttons.length).toBeGreaterThan(0);
	});

	it("shows delete button for own comments", async () => {
		const { CommentCard } = await import("../../../src/components/comments/CommentCard");
		render(<CommentCard comment={mockComment} currentUserId="user1" />);
		const buttons = screen.getAllByRole("button");
		// Should have like button and delete button
		expect(buttons.length).toBe(2);
	});

	it("does not show delete button for other users comments", async () => {
		const { CommentCard } = await import("../../../src/components/comments/CommentCard");
		render(<CommentCard comment={mockComment} currentUserId="user2" />);
		expect(screen.queryByTitle("Delete comment")).not.toBeInTheDocument();
		// Like + Report: other users' comments can be reported, not deleted
		expect(screen.getAllByRole("button").length).toBe(2);
		expect(screen.getByRole("button", { name: "Report comment" })).toBeInTheDocument();
	});

	it("does not show report button on own comments or when logged out", async () => {
		const { CommentCard } = await import("../../../src/components/comments/CommentCard");
		const { unmount } = render(<CommentCard comment={mockComment} currentUserId="user1" />);
		expect(screen.queryByRole("button", { name: "Report comment" })).not.toBeInTheDocument();
		unmount();
		render(<CommentCard comment={mockComment} />);
		expect(screen.queryByRole("button", { name: "Report comment" })).not.toBeInTheDocument();
	});
});

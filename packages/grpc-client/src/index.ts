// Re-export proto types for convenience
export * from "@tweety/proto";
export type { TweetyClient, TweetyClientConfig } from "./client";
export { createTweetyClient, DEFAULT_GRPC_HOST } from "./client";

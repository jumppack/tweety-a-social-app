import { ChannelCredentials } from "@grpc/grpc-js";
import { GrpcTransport } from "@protobuf-ts/grpc-transport";
import {
	AdminServiceClient,
	AuthServiceClient,
	BookmarksServiceClient,
	CommentsServiceClient,
	FeedServiceClient,
	FollowsServiceClient,
	LikesServiceClient,
	NotificationsServiceClient,
	PostsServiceClient,
	ReportsServiceClient,
	SearchServiceClient,
	UsersServiceClient,
} from "@tweety/proto";

export interface TweetyClientConfig {
	host: string;
	secure?: boolean;
}

export interface TweetyClient {
	auth: AuthServiceClient;
	posts: PostsServiceClient;
	comments: CommentsServiceClient;
	likes: LikesServiceClient;
	follows: FollowsServiceClient;
	feed: FeedServiceClient;
	search: SearchServiceClient;
	users: UsersServiceClient;
	admin: AdminServiceClient;
	notifications: NotificationsServiceClient;
	bookmarks: BookmarksServiceClient;
	reports: ReportsServiceClient;
	transport: GrpcTransport;
}

/**
 * Creates a gRPC client for the Tweety API
 */
export function createTweetyClient(config: TweetyClientConfig): TweetyClient {
	const { host, secure = false } = config;

	const channelCredentials = secure
		? ChannelCredentials.createSsl()
		: ChannelCredentials.createInsecure();

	const transport = new GrpcTransport({
		host,
		channelCredentials,
	});

	return {
		auth: new AuthServiceClient(transport),
		posts: new PostsServiceClient(transport),
		comments: new CommentsServiceClient(transport),
		likes: new LikesServiceClient(transport),
		follows: new FollowsServiceClient(transport),
		feed: new FeedServiceClient(transport),
		search: new SearchServiceClient(transport),
		users: new UsersServiceClient(transport),
		admin: new AdminServiceClient(transport),
		notifications: new NotificationsServiceClient(transport),
		bookmarks: new BookmarksServiceClient(transport),
		reports: new ReportsServiceClient(transport),
		transport,
	};
}

/**
 * Default API host for development
 */
export const DEFAULT_GRPC_HOST = "localhost:50051";

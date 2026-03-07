import { ApiClient } from './api';
import { BotPersona } from './identities';
import { generateTextPost, generatePollPost, generateComment } from './content';
import { fetchAndUploadImage } from './media';

// ============================================================================
// Types
// ============================================================================

export interface BotInstance {
    api: ApiClient;
    persona: BotPersona;
    userId?: string;
    verified: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function randomItem<T>(arr: T[]): T | undefined {
    if (arr.length === 0) return undefined;
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomReaction(): 'LIKES' | 'SUPPORT' {
    return Math.random() > 0.4 ? 'LIKES' : 'SUPPORT';
}

/** ISO date N days from now */
function daysFromNow(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString();
}

/**
 * Safely extract a channel ID from a channel list item.
 * The response shape may vary — channel data could be nested under a `.channel` key.
 */
function getChannelId(ch: any): string | undefined {
    return ch?.id ?? ch?.channel?.id;
}

function getChannelName(ch: any): string {
    return ch?.name ?? ch?.channel?.name ?? ch?.slug ?? 'Unknown';
}

function getPostId(post: any): string | undefined {
    return post?.id ?? post?.post?.id;
}

function getPostContent(post: any): { title: string; body: string } {
    const c = post?.content ?? post?.post?.content;
    return { title: c?.title ?? '', body: c?.body ?? '' };
}

function getPostPoll(post: any): any {
    return post?.content?.poll ?? post?.post?.content?.poll;
}

function getPostUserId(post: any): string | undefined {
    return post?.user_id ?? post?.post?.user_id;
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Create a text-only post (NOT added to any channel).
 */
export async function createTextPost(bot: BotInstance): Promise<void> {
    const content = await generateTextPost(
        undefined, undefined,
        { company: bot.persona.company, jobTitle: bot.persona.jobTitle, fullName: bot.persona.fullName },
    );

    const post = await bot.api.createPost({
        type: 'TEXT',
        content: { title: content.title, body: content.body },
    });

    console.log(`[action] ${bot.persona.username} created text post: "${content.title}" (id: ${post?.id})`);
}

/**
 * Create a media post with a real image from Pexels (NOT added to any channel).
 */
export async function createMediaPost(bot: BotInstance): Promise<void> {
    const content = await generateTextPost(
        undefined, undefined,
        { company: bot.persona.company, jobTitle: bot.persona.jobTitle, fullName: bot.persona.fullName },
    );

    // Fetch and upload image
    const mediaKey = content.imageQuery
        ? await fetchAndUploadImage(bot.api, content.imageQuery)
        : null;

    if (mediaKey) {
        const post = await bot.api.createPost({
            type: 'MEDIA',
            content: { title: content.title, body: content.body, media_files: [mediaKey] },
        });
        console.log(`[action] ${bot.persona.username} created media post: "${content.title}" (id: ${post?.id})`);
    } else {
        // Fallback to text post if image fetch failed
        const post = await bot.api.createPost({
            type: 'TEXT',
            content: { title: content.title, body: content.body },
        });
        console.log(`[action] ${bot.persona.username} created text post (media fallback): "${content.title}" (id: ${post?.id})`);
    }
}

/**
 * Create a text post and add it to a random channel.
 */
export async function createChannelTextPost(bot: BotInstance): Promise<void> {
    // Pick a random channel type
    const channelTypes = ['TOPIC', 'COMPANY', 'LOCATION', 'HASHTAG', 'CHANNEL'];
    const channelType = randomItem(channelTypes)!;

    // Get available channels
    const channelsResp = await bot.api.listChannels({ type: channelType, limit: 20 });
    const channels: any[] = channelsResp.data ?? [];
    if (channels.length === 0) {
        console.log(`[action] No ${channelType} channels found, falling back to regular text post`);
        return createTextPost(bot);
    }

    const channel = randomItem(channels)!;
    const channelName = getChannelName(channel);
    const channelId = getChannelId(channel);
    if (!channelId) {
        console.log(`[action] Channel has no ID, falling back to regular text post`);
        return createTextPost(bot);
    }

    // Generate channel-aware content
    const content = await generateTextPost(
        channelName, channelType,
        { company: bot.persona.company, jobTitle: bot.persona.jobTitle, fullName: bot.persona.fullName },
    );

    const post = await bot.api.createPost({
        type: 'TEXT',
        content: { title: content.title, body: content.body },
    });

    // Add to channel
    await bot.api.addPostToChannel(channelId, post?.id);
    console.log(`[action] ${bot.persona.username} posted "${content.title}" to channel "${channelName}" (${channelType})`);
}

/**
 * Create a media post and add it to a random channel.
 */
export async function createChannelMediaPost(bot: BotInstance): Promise<void> {
    const channelTypes = ['TOPIC', 'COMPANY', 'LOCATION', 'HASHTAG', 'CHANNEL'];
    const channelType = randomItem(channelTypes)!;

    const channelsResp = await bot.api.listChannels({ type: channelType, limit: 20 });
    const channels: any[] = channelsResp.data ?? [];
    if (channels.length === 0) {
        return createMediaPost(bot);
    }

    const channel = randomItem(channels)!;
    const channelName = getChannelName(channel);
    const channelId = getChannelId(channel);
    if (!channelId) return createMediaPost(bot);

    const content = await generateTextPost(
        channelName, channelType,
        { company: bot.persona.company, jobTitle: bot.persona.jobTitle, fullName: bot.persona.fullName },
    );

    const mediaKey = content.imageQuery
        ? await fetchAndUploadImage(bot.api, content.imageQuery)
        : null;

    const postType = mediaKey ? 'MEDIA' : 'TEXT';
    const mediaFiles = mediaKey ? [mediaKey] : undefined;

    const post = await bot.api.createPost({
        type: postType as any,
        content: { title: content.title, body: content.body, media_files: mediaFiles },
    });

    await bot.api.addPostToChannel(channelId, post?.id);
    console.log(`[action] ${bot.persona.username} posted "${content.title}" (${postType}) to "${channelName}"`);
}

/**
 * Create a poll post.
 */
export async function createPollPost(bot: BotInstance): Promise<void> {
    const pollContent = await generatePollPost(
        undefined, undefined,
        { company: bot.persona.company, jobTitle: bot.persona.jobTitle },
    );

    const now = new Date().toISOString();
    const post = await bot.api.createPost({
        type: 'POLL',
        content: {
            title: pollContent.title,
            poll: {
                items: pollContent.options,
                start_time: now,
                end_time: daysFromNow(3),
            },
        },
    });

    console.log(`[action] ${bot.persona.username} created poll: "${pollContent.title}" with ${pollContent.options.length} options (id: ${post?.id})`);
}

/**
 * React (like/support) to a post from the feed.
 */
export async function reactToPost(bot: BotInstance): Promise<void> {
    const posts = await bot.api.listPosts({ limit: 20, sortBy: 'recent' });
    const postList: any[] = posts.data ?? [];
    if (postList.length === 0) {
        console.log(`[action] No posts to react to`);
        return;
    }

    const post = randomItem(postList)!;
    const postId = getPostId(post);
    if (!postId) return;

    const reaction = randomReaction();
    await bot.api.addReaction({ post_id: postId, reaction });
    console.log(`[action] ${bot.persona.username} reacted ${reaction} to post ${postId}`);
}

/**
 * React (like/support) to a comment on a post.
 */
export async function reactToComment(bot: BotInstance): Promise<void> {
    const posts = await bot.api.listPosts({ limit: 10, sortBy: 'popular' });
    const postList: any[] = posts.data ?? [];
    if (postList.length === 0) return;

    const post = randomItem(postList)!;
    const postId = getPostId(post);
    if (!postId) return;

    const commentsResp = await bot.api.listComments({ parentPostId: postId, limit: 10 });
    const comments: any[] = commentsResp.data ?? [];
    if (comments.length === 0) {
        console.log(`[action] No comments to react to on post ${postId}`);
        return;
    }

    const comment = randomItem(comments)!;
    const commentId = comment?.id ?? comment?.comment?.id;
    if (!commentId) return;

    const reaction = randomReaction();
    await bot.api.addReaction({ comment_id: commentId, reaction });
    console.log(`[action] ${bot.persona.username} reacted ${reaction} to comment ${commentId}`);
}

/**
 * Comment on an existing post — uses OpenAI for contextual comment.
 */
export async function commentOnPost(bot: BotInstance): Promise<void> {
    const posts = await bot.api.listPosts({ limit: 20, sortBy: 'recent' });
    const postList: any[] = posts.data ?? [];
    if (postList.length === 0) return;

    const post = randomItem(postList)!;
    const postId = getPostId(post);
    const { title: postTitle, body: postBody } = getPostContent(post);
    if (!postId) return;

    const commentContent = await generateComment(
        postTitle, postBody,
        { company: bot.persona.company, jobTitle: bot.persona.jobTitle },
    );

    await bot.api.createComment({
        content: commentContent.text,
        parent_post_id: postId,
    });

    console.log(`[action] ${bot.persona.username} commented on post ${postId}: "${commentContent.text.substring(0, 50)}..."`);
}

/**
 * Vote on a random poll.
 */
export async function voteOnPoll(bot: BotInstance): Promise<void> {
    const posts = await bot.api.listPosts({ limit: 20, type: 'POLL' });
    const pollPosts: any[] = posts.data ?? [];
    if (pollPosts.length === 0) {
        console.log(`[action] No polls found to vote on`);
        return;
    }

    const post = randomItem(pollPosts)!;
    const postId = getPostId(post);
    const poll = getPostPoll(post);
    if (!postId || !poll || !poll.items || poll.items.length === 0) return;

    const option: any = randomItem(poll.items as any[]);
    const optionId = option?.id;
    if (!optionId) return;

    await bot.api.addVote({ post_id: postId, poll_option_id: optionId });
    console.log(`[action] ${bot.persona.username} voted "${option?.text}" on poll ${postId}`);
}

/**
 * Follow a user from the feed or post list.
 */
export async function followUser(bot: BotInstance): Promise<void> {
    const feedResp = await bot.api.getFeed({ limit: 20 });
    const feedItems: any[] = feedResp.data ?? [];

    if (feedItems.length === 0) {
        // If feed is empty, try listing posts instead
        const posts = await bot.api.listPosts({ limit: 20 });
        const postList: any[] = posts.data ?? [];
        const post = randomItem(postList);
        const userId = getPostUserId(post);
        if (userId && userId !== bot.userId) {
            await bot.api.followUser(userId);
            console.log(`[action] ${bot.persona.username} followed user ${userId}`);
        }
        return;
    }

    const feedItem = randomItem(feedItems)!;
    const userId = feedItem?.followee?.id ?? feedItem?.post?.post?.user_id;
    if (userId && userId !== bot.userId) {
        await bot.api.followUser(userId);
        console.log(`[action] ${bot.persona.username} followed user ${userId}`);
    }
}

/**
 * Follow a random channel.
 */
export async function followChannel(bot: BotInstance): Promise<void> {
    const channelTypes = ['TOPIC', 'COMPANY', 'LOCATION', 'HASHTAG', 'CHANNEL'];
    const channelType = randomItem(channelTypes)!;

    const channelsResp = await bot.api.listChannels({ type: channelType, limit: 20 });
    const channels: any[] = channelsResp.data ?? [];
    if (channels.length === 0) {
        console.log(`[action] No channels to follow`);
        return;
    }

    const channel = randomItem(channels)!;
    const channelId = getChannelId(channel);
    if (!channelId) return;

    await bot.api.followChannel(channelId);
    console.log(`[action] ${bot.persona.username} followed channel "${getChannelName(channel)}" (${channelType})`);
}

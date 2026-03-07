import axios, { AxiosInstance, AxiosError } from 'axios';

// ============================================================================
// API Client — matches all backend endpoints
// ============================================================================

export class ApiClient {
    private client: AxiosInstance;
    private accessToken: string | null = null;
    private refreshToken: string | null = null;
    private csrfToken: string | null = null;

    constructor(baseUrl: string) {
        this.client = axios.create({
            baseURL: baseUrl,
            timeout: 30000,
            withCredentials: true,
        });

        // Attach auth + CSRF headers to every request
        this.client.interceptors.request.use((config) => {
            if (this.accessToken) {
                config.headers['Authorization'] = `Bearer ${this.accessToken}`;
            }
            if (this.csrfToken) {
                config.headers['X-Csrf-Token'] = this.csrfToken;
            }
            return config;
        });
    }

    // ---------- Auth ----------

    async fetchCsrfToken(): Promise<void> {
        try {
            const resp = await this.client.get('/csrf-token');
            this.csrfToken = resp.data?.token ?? null;
        } catch {
            this.csrfToken = null;
        }
    }

    async register(data: { email: string; username: string; password: string }) {
        const resp = await this.client.post('/users/register', data);
        const body = resp.data;
        if (body.access_token) this.accessToken = body.access_token;
        if (body.refresh_token) this.refreshToken = body.refresh_token;
        return body;
    }

    async login(data: { username: string; password: string }) {
        const resp = await this.client.post('/users/customer-login', data);
        const body = resp.data;
        if (body.access_token) this.accessToken = body.access_token;
        if (body.refresh_token) this.refreshToken = body.refresh_token;
        return body;
    }

    async refreshAccessToken(): Promise<boolean> {
        if (!this.refreshToken) return false;
        try {
            const resp = await this.client.post('/users/refresh-token', {
                refresh_token: this.refreshToken,
            });
            const body = resp.data;
            if (body.access_token) {
                this.accessToken = body.access_token;
                return true;
            }
        } catch {
            // refresh failed
        }
        return false;
    }

    async updateProfile(data: {
        summary?: string;
        company_name?: string;
        job_title?: string;
        username?: string;
    }) {
        return (await this.client.patch('/users/update-profile', data)).data;
    }

    // ---------- Posts ----------

    async listPosts(opts: { limit?: number; page?: number; sortBy?: string; type?: string } = {}) {
        return (await this.client.get('/posts/list', {
            params: {
                limit: opts.limit ?? 20,
                page: opts.page ?? 1,
                sort_by: opts.sortBy ?? 'recent',
                type: opts.type,
            }
        })).data;
    }

    async createPost(data: {
        type: 'TEXT' | 'MEDIA' | 'POLL';
        content: {
            title: string;
            body?: string;
            media_files?: string[];
            poll?: { items: string[]; start_time: string; end_time: string };
        };
    }) {
        return (await this.client.post('/posts/new-post', data)).data;
    }

    // ---------- Channels ----------

    async listChannels(opts: { type?: string; page?: number; limit?: number } = {}) {
        return (await this.client.get('/channels/list', {
            params: {
                type: opts.type,
                page: opts.page ?? 1,
                limit: opts.limit ?? 50,
            }
        })).data;
    }

    async followChannel(channelId: string) {
        return (await this.client.post(`/channels/${channelId}/follow`)).data;
    }

    async addPostToChannel(channelId: string, postId: string) {
        return (await this.client.post(`/channels/${channelId}/add-post`, {
            post_id: postId,
        })).data;
    }

    async getChannelFeed(channelId: string, opts: { page?: number; limit?: number } = {}) {
        return (await this.client.get(`/channels/${channelId}/posts`, {
            params: {
                page: opts.page ?? 1,
                limit: opts.limit ?? 20,
            }
        })).data;
    }

    // ---------- Engagements ----------

    async addReaction(data: { post_id?: string; comment_id?: string; reaction: 'LIKES' | 'SUPPORT' }) {
        return (await this.client.post('/engagements/add-reaction', data)).data;
    }

    async addVote(data: { post_id: string; poll_option_id: string }) {
        return (await this.client.post('/engagements/add-vote', data)).data;
    }

    // ---------- Comments ----------

    async listComments(opts: { parentPostId?: string; parentCommentId?: string; page?: number; limit?: number } = {}) {
        return (await this.client.get('/comments/list-comments', {
            params: {
                parent_post_id: opts.parentPostId,
                parent_comment_id: opts.parentCommentId,
                page: opts.page ?? 1,
                limit: opts.limit ?? 20,
            }
        })).data;
    }

    async createComment(data: { content: string; parent_post_id?: string; parent_comment_id?: string }) {
        return (await this.client.post('/comments/new-comment', data)).data;
    }

    // ---------- Relationships ----------

    async followUser(userId: string) {
        return (await this.client.post('/relationships/follow', { user_id: userId })).data;
    }

    // ---------- Media ----------

    async getPresignedUrl(data: { filename: string; file_type: string; folder: string }) {
        return (await this.client.post('/media/presigned-url', data)).data as {
            upload_url: string;
            key: string;
        };
    }

    async uploadToS3(uploadUrl: string, buffer: Buffer, contentType: string) {
        await axios.put(uploadUrl, buffer, {
            headers: { 'Content-Type': contentType },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
        });
    }

    async processMedia(data: { key: string; file_type: string }) {
        return (await this.client.post('/media/process', data)).data;
    }

    // ---------- Feeds ----------

    async getFeed(opts: { page?: number; limit?: number } = {}) {
        return (await this.client.get('/feeds', {
            params: {
                page: opts.page ?? 1,
                limit: opts.limit ?? 20,
            }
        })).data;
    }

    // ---------- Helpers ----------

    isAuthenticated(): boolean {
        return this.accessToken !== null;
    }

    static isUnauthorized(err: unknown): boolean {
        return err instanceof AxiosError && err.response?.status === 401;
    }

    static is4xx(err: unknown): boolean {
        return err instanceof AxiosError && (err.response?.status ?? 0) >= 400 && (err.response?.status ?? 0) < 500;
    }
}

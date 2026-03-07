import axios from 'axios';
import { ApiClient } from './api';

// ============================================================================
// Pexels image search + S3 upload pipeline
// ============================================================================

const PEXELS_API_KEY = process.env.PEXELS_API_KEY ?? '';

interface PexelsPhoto {
    src: {
        original: string;
        large: string;
        medium: string;
    };
}

/**
 * Search Pexels for a photo matching the query.
 * Returns the image URL or null if nothing found.
 */
async function searchPexelsImage(query: string): Promise<string | null> {
    if (!PEXELS_API_KEY || !query.trim()) return null;

    try {
        const resp = await axios.get('https://api.pexels.com/v1/search', {
            headers: { Authorization: PEXELS_API_KEY },
            params: {
                query,
                per_page: 10,
                orientation: 'landscape',
            },
        });

        const photos: PexelsPhoto[] = resp.data?.photos ?? [];
        if (photos.length === 0) return null;

        // Pick a random photo from the results for variety
        const photo = photos[Math.floor(Math.random() * photos.length)]!;
        return photo.src.large || photo.src.medium || photo.src.original;
    } catch (err) {
        console.error('[media] Pexels search failed:', (err as Error).message);
        return null;
    }
}

/**
 * Download an image from a URL into a Buffer.
 */
async function downloadImage(url: string): Promise<{ buffer: Buffer; contentType: string }> {
    const resp = await axios.get(url, { responseType: 'arraybuffer' });
    const contentType = resp.headers['content-type'] ?? 'image/jpeg';
    return {
        buffer: Buffer.from(resp.data),
        contentType,
    };
}

/**
 * Full pipeline: search for image → download → upload to S3 → process → return key.
 * Returns the S3 key or null if any step fails.
 */
export async function fetchAndUploadImage(
    api: ApiClient,
    searchQuery: string,
): Promise<string | null> {
    try {
        // 1. Search for a relevant image
        const imageUrl = await searchPexelsImage(searchQuery);
        if (!imageUrl) {
            console.log(`[media] No image found for query: "${searchQuery}"`);
            return null;
        }

        // 2. Download the image
        const { buffer, contentType } = await downloadImage(imageUrl);

        // Determine extension from content type
        const extMap: Record<string, string> = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp',
        };
        const ext = extMap[contentType] ?? 'jpg';
        const filename = `bot_${Date.now()}.${ext}`;

        // 3. Get presigned URL from backend
        const presigned = await api.getPresignedUrl({
            filename,
            file_type: contentType,
            folder: 'posts',
        });

        // 4. Upload to S3
        await api.uploadToS3(presigned.upload_url, buffer, contentType);

        // 5. Trigger media processing
        await api.processMedia({ key: presigned.key, file_type: contentType });

        console.log(`[media] Uploaded image: ${presigned.key}`);
        return presigned.key;
    } catch (err) {
        console.error('[media] Image pipeline failed:', (err as Error).message);
        return null;
    }
}

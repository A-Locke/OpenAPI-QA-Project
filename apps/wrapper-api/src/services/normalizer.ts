import { TikTokVideo, RawApifyVideoSchema } from '@specguard/shared-types';
import type { TikTokAuthor, RawApifyVideo } from '@specguard/shared-types';

/**
 * Normalizes a raw Apify TikTok video item into the stable internal TikTokVideo model.
 *
 * This is the schema boundary between upstream and internal contracts.
 * All field renames, type coercions, and fallbacks live here — not in routes or services.
 *
 * Upstream field variants handled:
 *   id / awemeId → id
 *   text / desc / caption → caption
 *   diggCount / statsV2.diggCount / stats.diggCount → likes
 *   playCount / statsV2.playCount / stats.playCount → views
 *   authorMeta / author → author
 *   createTime (Unix epoch seconds) → createdAt (ISO 8601)
 *   hashtags[string|{name}] / challenges[{title}] → hashtags
 */
export function normalizeVideo(rawInput: unknown): TikTokVideo {
  // Validate at boundary — passthrough schema absorbs unknown upstream fields
  const raw = RawApifyVideoSchema.parse(rawInput);

  return {
    id: String(raw.id ?? raw.awemeId ?? ''),
    caption: String(raw.text ?? raw.desc ?? raw.caption ?? ''),
    likes: toNonNegativeInt(
      raw.diggCount ?? raw.statsV2?.diggCount ?? raw.stats?.diggCount
    ),
    views: toNonNegativeInt(
      raw.playCount ?? raw.statsV2?.playCount ?? raw.stats?.playCount
    ),
    comments: toNonNegativeInt(
      raw.commentCount ?? raw.statsV2?.commentCount ?? raw.stats?.commentCount
    ),
    shares: toNonNegativeInt(
      raw.shareCount ?? raw.statsV2?.shareCount ?? raw.stats?.shareCount
    ),
    // Pass authorMeta and author separately so TypeScript knows each object's shape.
    // Merging them into a single variable creates a union type where fields like
    // `fans` and `nickName` (authorMeta-only) become inaccessible.
    author: resolveAuthor(raw.authorMeta, raw.author),
    videoUrl: String(raw.video?.playAddr ?? raw.video?.downloadAddr ?? raw.videoUrl ?? '') || undefined,
    thumbnailUrl: String(raw.video?.cover ?? raw.thumbnailUrl ?? '') || undefined,
    createdAt: unixToIso(raw.createTime),
    hashtags: extractHashtags(raw),
  };
}

/**
 * Resolves author fields from either authorMeta (newer actor format) or
 * author (older format), preferring authorMeta when both are present.
 * Each parameter is typed independently so TypeScript can verify field access.
 */
function resolveAuthor(
  meta: RawApifyVideo['authorMeta'],
  author: RawApifyVideo['author']
): TikTokAuthor {
  return {
    username: String(meta?.uniqueId ?? meta?.name ?? author?.uniqueId ?? ''),
    displayName: String(meta?.nickName ?? meta?.nickname ?? author?.nickname ?? '') || undefined,
    followers: toNonNegativeInt(meta?.fans ?? author?.followerCount),
    verified: meta?.verified ?? author?.verified ?? undefined,
  };
}

function toNonNegativeInt(value: unknown): number {
  const n = parseInt(String(value ?? 0), 10);
  return isNaN(n) || n < 0 ? 0 : n;
}

/** Converts upstream Unix timestamp (seconds) to ISO 8601 string. */
function unixToIso(createTime: number | undefined): string {
  if (!createTime || isNaN(createTime)) return new Date(0).toISOString();
  return new Date(createTime * 1000).toISOString();
}

function extractHashtags(raw: ReturnType<typeof RawApifyVideoSchema.parse>): string[] {
  if (Array.isArray(raw.hashtags)) {
    return raw.hashtags.map((h: string | { name?: string }) =>
      typeof h === 'string' ? h : String(h.name ?? '')
    );
  }
  if (Array.isArray(raw.challenges)) {
    return raw.challenges.map((c: { title?: string }) => String(c.title ?? ''));
  }
  return [];
}

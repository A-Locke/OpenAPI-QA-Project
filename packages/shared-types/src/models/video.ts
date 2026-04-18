import { z } from 'zod';

export const TikTokAuthorSchema = z.object({
  /** Unique TikTok handle — normalized from upstream `uniqueId` */
  username: z.string(),
  /** Display name / nickname */
  displayName: z.string().optional(),
  /** Follower count — normalized from upstream `fans` or `followerCount` */
  followers: z.number().int().nonnegative().optional(),
  verified: z.boolean().optional(),
});

export type TikTokAuthor = z.infer<typeof TikTokAuthorSchema>;

export const TikTokVideoSchema = z.object({
  /** TikTok video ID */
  id: z.string(),
  /** Caption / description text */
  caption: z.string(),
  /** Like count — normalized from upstream `diggCount` / `statsV2.diggCount` */
  likes: z.number().int().nonnegative(),
  /** View count — normalized from upstream `playCount` / `statsV2.playCount` */
  views: z.number().int().nonnegative(),
  /** Comment count */
  comments: z.number().int().nonnegative(),
  /** Share count */
  shares: z.number().int().nonnegative(),
  author: TikTokAuthorSchema,
  /** Streaming URL — optional, may be empty depending on actor config */
  videoUrl: z.string().optional(),
  /** Thumbnail / cover image URL */
  thumbnailUrl: z.string().optional(),
  /** ISO 8601 post timestamp — normalized from upstream Unix `createTime` */
  createdAt: z.string().datetime(),
  /** Hashtags extracted from caption or upstream `challenges` list */
  hashtags: z.array(z.string()),
});

export type TikTokVideo = z.infer<typeof TikTokVideoSchema>;

/**
 * Raw Apify TikTok video schema — intentionally loose to absorb all known
 * actor versions and field layout variants. Validated at the normalization
 * boundary before conversion to TikTokVideo.
 */
export const RawApifyVideoSchema = z
  .object({
    id: z.coerce.string().optional(),
    awemeId: z.coerce.string().optional(),
    text: z.string().optional(),
    desc: z.string().optional(),
    caption: z.string().optional(),
    // Top-level stat fields (older actor versions)
    diggCount: z.coerce.number().optional(),
    playCount: z.coerce.number().optional(),
    commentCount: z.coerce.number().optional(),
    shareCount: z.coerce.number().optional(),
    // Nested stat objects (newer actor versions)
    statsV2: z
      .object({
        diggCount: z.coerce.number().optional(),
        playCount: z.coerce.number().optional(),
        commentCount: z.coerce.number().optional(),
        shareCount: z.coerce.number().optional(),
      })
      .optional(),
    stats: z
      .object({
        diggCount: z.coerce.number().optional(),
        playCount: z.coerce.number().optional(),
        commentCount: z.coerce.number().optional(),
        shareCount: z.coerce.number().optional(),
      })
      .optional(),
    // Author metadata variants
    authorMeta: z
      .object({
        uniqueId: z.string().optional(),
        name: z.string().optional(),
        nickName: z.string().optional(),
        nickname: z.string().optional(),
        fans: z.coerce.number().optional(),
        followerCount: z.coerce.number().optional(),
        verified: z.boolean().optional(),
      })
      .optional(),
    author: z
      .object({
        uniqueId: z.string().optional(),
        nickname: z.string().optional(),
        followerCount: z.coerce.number().optional(),
        verified: z.boolean().optional(),
      })
      .optional(),
    video: z
      .object({
        playAddr: z.string().optional(),
        downloadAddr: z.string().optional(),
        cover: z.string().optional(),
      })
      .optional(),
    videoUrl: z.string().optional(),
    thumbnailUrl: z.string().optional(),
    createTime: z.coerce.number().optional(),
    // Hashtag variants
    hashtags: z.array(z.union([z.string(), z.object({ name: z.string().optional() })])).optional(),
    challenges: z.array(z.object({ title: z.string().optional() })).optional(),
  })
  .passthrough(); // allow undocumented upstream fields without throwing

export type RawApifyVideo = z.infer<typeof RawApifyVideoSchema>;

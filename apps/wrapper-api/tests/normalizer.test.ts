import { describe, it, expect } from 'vitest';
import { normalizeVideo } from '../src/services/normalizer';

describe('normalizeVideo', () => {
  it('maps top-level stat fields (older actor format)', () => {
    const raw = {
      id: '123',
      text: 'Hello world',
      diggCount: 1000,
      playCount: 50000,
      commentCount: 200,
      shareCount: 50,
      authorMeta: { uniqueId: 'testuser', fans: 9999 },
      createTime: 1704067200, // 2024-01-01T00:00:00Z
    };
    const video = normalizeVideo(raw);
    expect(video.id).toBe('123');
    expect(video.caption).toBe('Hello world');
    expect(video.likes).toBe(1000);
    expect(video.views).toBe(50000);
    expect(video.comments).toBe(200);
    expect(video.shares).toBe(50);
    expect(video.author.username).toBe('testuser');
    expect(video.author.followers).toBe(9999);
    expect(video.createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(video.hashtags).toEqual([]);
  });

  it('maps statsV2 nested fields (newer actor format)', () => {
    const raw = {
      id: '456',
      desc: 'Newer format',
      statsV2: { diggCount: 500, playCount: 10000, commentCount: 30, shareCount: 5 },
      author: { uniqueId: 'newuser', followerCount: 123, verified: true },
      createTime: 1704153600, // 2024-01-02T00:00:00Z
    };
    const video = normalizeVideo(raw);
    expect(video.likes).toBe(500);
    expect(video.views).toBe(10000);
    expect(video.author.username).toBe('newuser');
    expect(video.author.followers).toBe(123);
    expect(video.author.verified).toBe(true);
    expect(video.createdAt).toBe('2024-01-02T00:00:00.000Z');
  });

  it('prefers authorMeta over author when both present', () => {
    const raw = {
      id: '789',
      authorMeta: { uniqueId: 'meta_user', fans: 100 },
      author: { uniqueId: 'author_user', followerCount: 200 },
    };
    const video = normalizeVideo(raw);
    expect(video.author.username).toBe('meta_user');
    expect(video.author.followers).toBe(100);
  });

  it('extracts hashtags from hashtags array of strings', () => {
    const raw = {
      id: '1',
      hashtags: ['trending', 'viral', 'fyp'],
    };
    const video = normalizeVideo(raw);
    expect(video.hashtags).toEqual(['trending', 'viral', 'fyp']);
  });

  it('extracts hashtags from hashtags array of objects', () => {
    const raw = {
      id: '1',
      hashtags: [{ name: 'trending' }, { name: 'fyp' }],
    };
    const video = normalizeVideo(raw);
    expect(video.hashtags).toEqual(['trending', 'fyp']);
  });

  it('falls back to challenges array for hashtags', () => {
    const raw = {
      id: '1',
      challenges: [{ title: 'dance' }, { title: 'music' }],
    };
    const video = normalizeVideo(raw);
    expect(video.hashtags).toEqual(['dance', 'music']);
  });

  it('uses awemeId when id is missing', () => {
    const raw = { awemeId: 'aweme_abc', text: 'test' };
    const video = normalizeVideo(raw);
    expect(video.id).toBe('aweme_abc');
  });

  it('handles missing createTime gracefully', () => {
    const raw = { id: '99' };
    const video = normalizeVideo(raw);
    expect(video.createdAt).toBe('1970-01-01T00:00:00.000Z');
  });

  it('coerces negative stat values to 0', () => {
    const raw = { id: '1', diggCount: -5, playCount: NaN };
    const video = normalizeVideo(raw);
    expect(video.likes).toBe(0);
    expect(video.views).toBe(0);
  });

  it('handles completely unknown/extra upstream fields without throwing', () => {
    const raw = {
      id: '1',
      unknownField: 'should be ignored',
      anotherFutureField: { nested: true },
    };
    expect(() => normalizeVideo(raw)).not.toThrow();
  });

  it('maps video URLs from nested video object', () => {
    const raw = {
      id: '1',
      video: {
        playAddr: 'https://v19.tiktok.com/video.mp4',
        cover: 'https://p16.tiktok.com/thumb.jpg',
      },
    };
    const video = normalizeVideo(raw);
    expect(video.videoUrl).toBe('https://v19.tiktok.com/video.mp4');
    expect(video.thumbnailUrl).toBe('https://p16.tiktok.com/thumb.jpg');
  });
});

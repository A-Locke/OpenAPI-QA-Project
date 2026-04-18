/**
 * Deterministic fixture data used by all mock scenarios.
 * All values match the internal OpenAPI schema — used to verify positive contract tests.
 */

export const VALID_RUN_ID = 'run-valid-abc123';
export const RUNNING_RUN_ID = 'run-running-def456';
export const FAILED_RUN_ID = 'run-failed-ghi789';
export const MISSING_FIELDS_RUN_ID = 'run-missing-fields';
export const INVALID_TYPES_RUN_ID = 'run-invalid-types';
export const SLOW_RUN_ID = 'run-slow-jkl012';

export const VALID_AUTHOR = {
  username: 'testuser',
  displayName: 'Test User',
  followers: 150000,
  verified: false,
};

export const VALID_VIDEO = {
  id: '7234567890123456789',
  caption: 'This is a test video #trending #fyp',
  likes: 150000,
  views: 2500000,
  comments: 3200,
  shares: 8500,
  author: VALID_AUTHOR,
  videoUrl: 'https://v19-webapp.tiktok.com/video/tos/test.mp4',
  thumbnailUrl: 'https://p16-sign.tiktokcdn.com/test.jpeg',
  createdAt: '2025-01-05T12:30:00.000Z',
  hashtags: ['trending', 'fyp'],
};

export const VALID_INIT_RESPONSE = {
  runId: VALID_RUN_ID,
  status: 'READY',
  startedAt: '2025-01-08T00:00:00.000Z',
};

export const VALID_RESULTS_RESPONSE = {
  runId: VALID_RUN_ID,
  status: 'SUCCEEDED',
  items: [VALID_VIDEO],
};

/** Missing required fields — used to test that the contract runner detects violations */
export const MISSING_FIELDS_RESPONSE = {
  runId: MISSING_FIELDS_RUN_ID,
  // status is intentionally missing
  items: [
    {
      id: '111',
      // caption intentionally missing
      likes: 100,
      // views intentionally missing
      comments: 10,
      shares: 5,
      author: { username: 'user1' },
      createdAt: '2025-01-01T00:00:00.000Z',
      hashtags: [],
    },
  ],
};

/** Wrong field types — used to test type violation detection */
export const INVALID_TYPES_RESPONSE = {
  runId: INVALID_TYPES_RUN_ID,
  status: 'SUCCEEDED',
  items: [
    {
      id: 999,              // should be string
      caption: 'test',
      likes: '150000',      // should be integer
      views: null,          // should be integer
      comments: 10,
      shares: 5,
      author: {
        username: 123,      // should be string
      },
      createdAt: '2025-01-01T00:00:00.000Z',
      hashtags: 'trending', // should be array
    },
  ],
};

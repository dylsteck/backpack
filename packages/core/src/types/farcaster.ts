/**
 * Farcaster-specific types for Backpack
 * 
 * These types represent the Farcaster protocol data structures
 * used when syncing casts from the network.
 */

/**
 * Author information for a cast
 */
export interface CastAuthor {
  /** Farcaster ID (numeric identifier) */
  fid: number;
  /** Username (e.g., "dylsteck") */
  username: string;
  /** Display name (e.g., "Dylan Steck") */
  displayName: string;
  /** Profile picture URL */
  pfp?: string;
}

/**
 * An embed attached to a cast
 */
export interface CastEmbed {
  /** URL for link embeds */
  url?: string;
  /** Cast ID for cast embeds (quoted casts) */
  castId?: string;
}

/**
 * A mention within a cast
 */
export interface CastMention {
  /** FID of mentioned user */
  fid: number;
  /** Position in the text where mention starts */
  position: number;
}

/**
 * Reaction counts for a cast
 */
export interface CastReactions {
  /** Number of likes */
  likes: number;
  /** Number of recasts */
  recasts: number;
}

/**
 * Reply information for a cast
 */
export interface CastReplies {
  /** Number of replies */
  count: number;
}

/**
 * A Farcaster cast (post)
 */
export interface Cast {
  /** Unique hash of the cast */
  hash: string;
  /** Hash of the thread this cast belongs to */
  threadHash?: string;
  /** Hash of parent cast (if reply) */
  parentHash?: string;
  /** Author of the cast */
  author: CastAuthor;
  /** Text content of the cast */
  text: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Embeds attached to the cast */
  embeds: CastEmbed[];
  /** Mentions in the cast */
  mentions: CastMention[];
  /** Reaction counts */
  reactions: CastReactions;
  /** Reply information */
  replies: CastReplies;
}

/**
 * Farcaster configuration stored in config file
 */
export interface FarcasterConfig {
  /** Farcaster ID (numeric) */
  fid?: number;
  /** Neynar signer UUID */
  signerUuid?: string;
  /** Username for display purposes */
  username?: string;
}

/**
 * State stored for incremental sync
 * This is persisted to enable efficient incremental syncing
 */
export interface FarcasterSyncState {
  /** Last cursor used for pagination */
  lastCursor?: string;
  /** Timestamp of last successful sync */
  lastSyncTimestamp?: number;
}

/**
 * Neynar API response for feed endpoint
 */
export interface NeynarFeedResponse {
  /** Array of casts */
  casts: Cast[];
  /** Next cursor for pagination */
  next?: {
    cursor?: string;
  };
}

/**
 * Neynar API error response
 */
export interface NeynarErrorResponse {
  /** Error code */
  code?: string;
  /** Error message */
  message?: string;
  /** HTTP status */
  status?: number;
}

/**
 * Rate limit information from Neynar API
 */
export interface NeynarRateLimit {
  /** Remaining requests */
  remaining: number;
  /** Total limit */
  limit: number;
  /** Reset time (Unix timestamp) */
  reset: number;
}

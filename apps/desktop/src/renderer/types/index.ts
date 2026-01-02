// Shared types for the vanilla TS renderer

export type SourceType = 'all' | 'farcaster' | 'chrome' | 'brave' | 'teller' | 'user';

export type ConnectionType = 'oauth' | 'local' | 'api';
export type ConnectionStatus = 'all' | 'connected' | 'disconnected';

export interface AppServer {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  connectionType: ConnectionType;
  oauth?: boolean;
  config?: Record<string, unknown>;
  connection?: {
    id?: string;
    status: 'connected' | 'disconnected';
    connectionMetadata?: {
      localPath?: string;
      [key: string]: unknown;
    };
  };
}

export interface TimelineItem {
  id: string;
  timestamp: Date;
  source: SourceType;
  type: string;
  data: unknown;
}

export interface BrowserHistoryEntry {
  url: string;
  title: string;
  timestamp: string;
  visitCount: number;
  lastVisitTime: number;
}

export interface BrowserHistoryGroup {
  id: string;
  domain: string;
  timestamp: Date;
  entries: BrowserHistoryEntry[];
}

// Route definitions
export type Route = '/' | '/apps' | '/onboarding' | `/apps/${string}`;

export interface RouteParams {
  appId?: string;
}

// Theme
export type ThemeMode = 'light' | 'dark' | 'system';

// Filter configs
export interface SourceFilterConfig {
  type: 'source';
  props: {
    selectedSources: SourceType[];
    onSourceChange: (sources: SourceType[]) => void;
    sourceCounts: Record<SourceType, number>;
  };
}

export interface ConnectionFilterConfig {
  type: 'connection';
  props: {
    selectedTypes: ConnectionType[];
    selectedStatus: ConnectionStatus;
    onTypeChange: (types: ConnectionType[]) => void;
    onStatusChange: (status: ConnectionStatus) => void;
  };
}

export type FilterConfig = SourceFilterConfig | ConnectionFilterConfig | null;

// Farcaster types (simplified)
export interface FarcasterCast {
  hash: string;
  text: string;
  timestamp: string;
  author: {
    fid: number;
    username: string;
    display_name: string;
    pfp_url?: string;
  };
  embeds?: Array<{
    url?: string;
    cast_id?: { fid: number; hash: string };
  }>;
  reactions?: {
    likes_count: number;
    recasts_count: number;
  };
  replies?: {
    count: number;
  };
}

// Teller types (simplified)
export interface TellerTransaction {
  id: string;
  account_id: string;
  amount: string;
  date: string;
  description: string;
  details: {
    category?: string;
    counterparty?: {
      name?: string;
      type?: string;
    };
    processing_status?: string;
  };
  status: string;
  type: string;
}

export interface Comment {
  id: string;
  itemId: string;
  content: string;
  createdAt: string | Date;
}

export interface ChatSession {
  id: string;
  title?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string | Date;
}


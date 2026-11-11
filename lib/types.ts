export type Platform = "Instagram" | "TikTok";
export type PostFormat = "carousel" | "story";
export type PostStatus = "pending_approval" | "scheduled" | "publishing" | "published" | "failed";

export type Slide = {
  /** Short, large headline rendered on the image. */
  headline: string;
  /** Supporting text rendered under the headline. */
  body: string;
};

export type Post = {
  id: string;
  format: PostFormat;
  platforms: Platform[];
  topic: string;
  slides: Slide[];
  caption: string;
  hashtags: string[];
  status: PostStatus;
  scheduledFor: string; // ISO date
  createdAt: string;
  createdBy: "agent" | "user";
  publishedAt?: string;
  results?: { platform: Platform; ok: boolean; id?: string; simulated?: boolean; error?: string }[];
  error?: string;
};

export type BrandTheme = {
  background: string;
  text: string;
  accent: string;
};

export type AgentSettings = {
  enabled: boolean;
  /** When true, agent-made posts are published without manual approval. */
  autoPublish: boolean;
  brandName: string;
  handle: string;
  description: string;
  audience: string;
  tone: string;
  pillars: string[];
  platforms: Platform[];
  carouselsPerWeek: number;
  storiesPerDay: number;
  /** Hours of day (0-23, in `timezoneOffsetMinutes` local time) the agent may post. */
  postingHours: number[];
  timezoneOffsetMinutes: number;
  theme: BrandTheme;
  lastRunAt?: string;
};

export type Store = {
  settings: AgentSettings;
  posts: Post[];
  log: { at: string; message: string }[];
};

export type GameKind = "official" | "community";
export type GameStatus = "draft" | "pending" | "published" | "rejected" | "hidden";
export type GameSource = "url" | "html";
export type ScoringRule = "high" | "low";
export type UserRole = "member" | "moderator" | "owner";

export type Profile = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  role: UserRole;
  created_at: string;
};

export type Prize = { rank: number; reward: string; note?: string };

export type Game = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  description: string | null;
  thumbnail_url: string | null;
  kind: GameKind;
  status: GameStatus;
  source: GameSource;
  entry_url: string | null;
  html: string | null;
  author_id: string | null;
  hackathon_id: string | null;
  scoring: ScoringRule;
  score_unit: string | null;
  tags: string[];
  play_count: number;
  like_count: number;
  comment_count: number;
  published_at: string | null;
  created_at: string;
  author?: Pick<Profile, "handle" | "display_name" | "avatar_url"> | null;
};

export type Hackathon = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  theme: string | null;
  rules: string | null;
  banner_url: string | null;
  starts_at: string;
  submit_ends_at: string;
  vote_ends_at: string | null;
  prizes: Prize[];
  is_published: boolean;
  created_at: string;
};

export type Tournament = {
  id: string;
  slug: string;
  game_id: string;
  title: string;
  description: string | null;
  banner_url: string | null;
  starts_at: string;
  ends_at: string;
  prizes: Prize[];
  max_attempts: number | null;
  is_published: boolean;
  results_locked: boolean;
  created_at: string;
  game?: Pick<Game, "slug" | "title" | "thumbnail_url" | "score_unit" | "scoring"> | null;
};

/** 대회 상세 — 게임을 바로 실행해야 하므로 실행에 필요한 필드까지 함께 옵니다. */
export type TournamentDetail = Omit<Tournament, "game"> & {
  game:
    | Pick<
        Game,
        | "id"
        | "slug"
        | "title"
        | "thumbnail_url"
        | "score_unit"
        | "scoring"
        | "source"
        | "entry_url"
        | "html"
        | "status"
      >
    | null;
};

export type LeaderboardRow = {
  user_id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  score: number;
  duration_ms: number | null;
  created_at: string;
  rank: number;
};

export type Comment = {
  id: string;
  game_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  is_deleted: boolean;
  created_at: string;
  author?: Pick<Profile, "handle" | "display_name" | "avatar_url"> | null;
};

/** 제작 노트 — 게임을 어떻게 만들었는지 남기는 글. 목록에서는 body 없이 옵니다. */
export type Note = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  body?: string;
  cover_url: string | null;
  video_url: string | null;
  game_id: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  game?: Pick<Game, "slug" | "title" | "tagline" | "thumbnail_url" | "kind" | "status"> | null;
};

export type Phase = "upcoming" | "live" | "ended";

export function phaseOf(startsAt: string, endsAt: string, now = Date.now()): Phase {
  const s = new Date(startsAt).getTime();
  const e = new Date(endsAt).getTime();
  if (now < s) return "upcoming";
  if (now > e) return "ended";
  return "live";
}

"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { AgentSettings, Platform, Post, PostFormat, Slide } from "@/lib/types";

type Status = { dryRun: boolean; publicBaseUrl: boolean; instagram: boolean; tiktok: boolean; openai: boolean };
type Tab = "create" | "queue" | "autopilot" | "activity";

const allPlatforms: Platform[] = ["Instagram", "TikTok"];
const tones = ["Friendly and confident", "Playful and witty", "Expert and informative", "Minimal and premium", "Bold and energetic"];
const statusLabels: Record<Post["status"], string> = {
  pending_approval: "NEEDS APPROVAL",
  scheduled: "SCHEDULED",
  publishing: "PUBLISHING…",
  published: "PUBLISHED",
  failed: "FAILED",
};

function toLocalInput(iso: string) {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? "Something went wrong.");
  return result as T;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("create");
  const [posts, setPosts] = useState<Post[]>([]);
  const [log, setLog] = useState<{ at: string; message: string }[]>([]);
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ posts: Post[]; log: typeof log; settings: AgentSettings; status: Status }>("/api/posts");
      setPosts(data.posts);
      setLog(data.log);
      setStatus(data.status);
      setSettings((current) => current ?? data.settings);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load data.");
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 20_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const pending = posts.filter((p) => p.status === "pending_approval").length;

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Edyx home"><span className="brand-mark">e</span> edyx</a>
        <span className="top-note">
          <span className={`status-dot ${settings?.enabled ? "" : "off"}`} />
          {settings?.enabled ? "AUTOPILOT ON" : "AUTOPILOT PAUSED"}
          {status?.dryRun && <span className="pill warn">DRY RUN</span>}
        </span>
      </header>

      <section className="hero compact" id="home">
        <div className="eyebrow">YOUR MARKETING AGENT</div>
        <h1>Carousels & stories,<br /><span>posted on autopilot.</span></h1>
        <p>Edyx plans, writes, designs, and publishes carousels and stories for your brand — on your schedule.</p>
      </section>

      {status && <Connections status={status} />}

      <nav className="tabs" aria-label="Sections">
        {(["create", "queue", "autopilot", "activity"] as Tab[]).map((key) => (
          <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
            {{ create: "Create", queue: "Queue", autopilot: "Autopilot", activity: "Activity" }[key]}
            {key === "queue" && pending > 0 && <span className="badge">{pending}</span>}
          </button>
        ))}
      </nav>

      {error && <div className="error-box" role="alert"><strong>Something went wrong</strong><p>{error}</p></div>}

      {tab === "create" && <CreatePanel onCreated={async () => { await refresh(); setTab("queue"); }} />}
      {tab === "queue" && <QueuePanel posts={posts} refresh={refresh} />}
      {tab === "autopilot" && settings && <AutopilotPanel settings={settings} setSettings={setSettings} refresh={refresh} />}
      {tab === "activity" && <ActivityPanel log={log} />}

      <footer><span>edyx</span><span>Make good things. Tell people.</span></footer>
    </main>
  );
}

function Connections({ status }: { status: Status }) {
  const items = [
    { label: "AI writer", ok: status.openai, hint: "OPENAI_API_KEY" },
    { label: "Instagram", ok: status.instagram, hint: "INSTAGRAM_ACCESS_TOKEN + INSTAGRAM_USER_ID" },
    { label: "TikTok", ok: status.tiktok, hint: "TIKTOK_ACCESS_TOKEN (optional)" },
    { label: "Public image URL", ok: status.publicBaseUrl, hint: "PUBLIC_BASE_URL" },
  ];
  return (
    <div className="connections">
      {items.map((item) => (
        <span key={item.label} className={`connection ${item.ok ? "ok" : ""}`} title={item.ok ? "Connected" : `Set ${item.hint}`}>
          <i />{item.label}
        </span>
      ))}
    </div>
  );
}

function PlatformPicker({ value, onChange, format }: { value: Platform[]; onChange: (p: Platform[]) => void; format?: PostFormat }) {
  return (
    <div className="platforms">
      {allPlatforms.map((platform) => {
        const disabled = format === "story" && platform === "TikTok";
        const selected = value.includes(platform) && !disabled;
        return (
          <button type="button" key={platform} disabled={disabled} title={disabled ? "TikTok doesn't offer a Stories API" : undefined}
            className={`platform-chip ${selected ? "selected" : ""}`} aria-pressed={selected}
            onClick={() => onChange(value.includes(platform) ? value.filter((p) => p !== platform) : [...value, platform])}>
            <span className="check">{selected ? "✓" : "+"}</span>{platform}
          </button>
        );
      })}
    </div>
  );
}

function CreatePanel({ onCreated }: { onCreated: () => void }) {
  const [format, setFormat] = useState<PostFormat>("carousel");
  const [topic, setTopic] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>(["Instagram"]);
  const [when, setWhen] = useState(() => toLocalInput(new Date(Date.now() + 3_600_000).toISOString()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const usable = platforms.filter((p) => format === "carousel" || p === "Instagram");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api("/api/posts", { method: "POST", body: JSON.stringify({ format, topic, platforms: usable, scheduledFor: new Date(when).toISOString() }) });
      setTopic("");
      onCreated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the post.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="workspace">
      <form className="brief-card" onSubmit={submit}>
        <div className="card-heading"><div><div className="step">01 / THE BRIEF</div><h2>What are we posting?</h2></div><span className="sparkle">✳</span></div>
        <div className="platform-label">FORMAT</div>
        <div className="platforms">
          {(["carousel", "story"] as PostFormat[]).map((f) => (
            <button type="button" key={f} className={`platform-chip ${format === f ? "selected" : ""}`} aria-pressed={format === f} onClick={() => setFormat(f)}>
              <span className="check">{format === f ? "✓" : "+"}</span>{f === "carousel" ? "Carousel (4:5)" : "Story (9:16)"}
            </button>
          ))}
        </div>
        <label htmlFor="topic">Topic, offer, or idea</label>
        <textarea id="topic" required maxLength={1000} value={topic} onChange={(e) => setTopic(e.target.value)}
          placeholder="Example: 5 ways commuters can stay hydrated on the go, featuring our new insulated bottle." />
        <div className="field-row">
          <div className="field"><label htmlFor="when">Publish at</label><input id="when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
          <div className="field"><label>Post to</label><PlatformPicker value={platforms} onChange={setPlatforms} format={format} /></div>
        </div>
        <button className="submit" type="submit" disabled={loading || !topic.trim() || usable.length === 0}>
          {loading ? <><span className="spinner" /> Writing & designing…</> : <>Create {format} <span aria-hidden="true">↗</span></>}
        </button>
        {error && <div className="error-box inline" role="alert">{error}</div>}
        <p className="fine-print">New posts land in your queue for a quick review. Brand details and colors come from the Autopilot tab.</p>
      </form>
      <div className="empty-state">
        <div className="empty-icon">✳</div>
        <div className="step">HOW IT WORKS</div>
        <h2>Brief in. Posts out.</h2>
        <p>Edyx writes every slide, renders on-brand images, and publishes at the time you pick. Turn on Autopilot and it plans a steady stream of carousels and stories by itself.</p>
        <ol className="how">
          <li>Set your brand & schedule in <b>Autopilot</b></li>
          <li>Create posts here, or let the agent make them</li>
          <li>Approve in <b>Queue</b> — or let them auto-publish</li>
        </ol>
      </div>
    </div>
  );
}

function SlideStrip({ post, version }: { post: Post; version: number }) {
  return (
    <div className={`slides ${post.format}`}>
      {post.slides.map((_, index) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={index} src={`/api/render/${post.id}/${index}.jpg?v=${version}`} alt={`Slide ${index + 1}: ${post.slides[index].headline}`} loading="lazy" />
      ))}
    </div>
  );
}

function PostCard({ post, refresh }: { post: Post; refresh: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ slides: post.slides, caption: post.caption, hashtags: post.hashtags.join(" "), when: toLocalInput(post.scheduledFor) });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const locked = post.status === "published" || post.status === "publishing";

  async function act(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError("");
    try {
      await fn();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Action failed.");
    } finally {
      setBusy("");
    }
  }

  const patch = (body: object) => api(`/api/posts/${post.id}`, { method: "PATCH", body: JSON.stringify(body) });

  function updateSlide(index: number, field: keyof Slide, value: string) {
    setDraft((d) => ({ ...d, slides: d.slides.map((s, i) => (i === index ? { ...s, [field]: value } : s)) }));
  }

  return (
    <article className="draft-card post-card">
      <div className="draft-top">
        <span className="draft-platform">{post.format === "carousel" ? "Carousel" : "Story"} · {post.platforms.join(" + ")}</span>
        <span className={`pill status-${post.status}`}>{statusLabels[post.status]}</span>
      </div>
      <h3>{post.topic}</h3>
      <p className="meta">
        {post.status === "published" && post.publishedAt ? `Published ${new Date(post.publishedAt).toLocaleString()}` : `Scheduled ${new Date(post.scheduledFor).toLocaleString()}`}
        {" · "}{post.createdBy === "agent" ? "made by agent" : "made by you"}
        {post.results?.some((r) => r.simulated) && " · dry run"}
      </p>
      <SlideStrip post={post} version={version} />

      {editing ? (
        <div className="editor">
          {draft.slides.map((slide, index) => (
            <div className="slide-edit" key={index}>
              <span>{index + 1}</span>
              <input value={slide.headline} maxLength={90} onChange={(e) => updateSlide(index, "headline", e.target.value)} aria-label={`Slide ${index + 1} headline`} />
              <textarea value={slide.body} maxLength={260} onChange={(e) => updateSlide(index, "body", e.target.value)} aria-label={`Slide ${index + 1} text`} />
            </div>
          ))}
          {post.format === "carousel" && <><label>Caption</label><textarea value={draft.caption} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} /></>}
          <div className="field-row">
            <div><label>Hashtags</label><input value={draft.hashtags} onChange={(e) => setDraft({ ...draft, hashtags: e.target.value })} /></div>
            <div><label>Publish at</label><input type="datetime-local" value={draft.when} onChange={(e) => setDraft({ ...draft, when: e.target.value })} /></div>
          </div>
          <div className="actions">
            <button className="action primary" disabled={!!busy} onClick={() => act("save", async () => {
              await patch({ slides: draft.slides, caption: draft.caption, hashtags: draft.hashtags.split(/[\s,]+/), scheduledFor: new Date(draft.when).toISOString() });
              setVersion((v) => v + 1);
              setEditing(false);
            })}>{busy === "save" ? "Saving…" : "Save changes"}</button>
            <button className="action" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          {post.format === "carousel" && post.caption && <p className="caption">{post.caption}</p>}
          {post.hashtags.length > 0 && <p className="hashtags">{post.hashtags.map((t) => `#${t}`).join(" ")}</p>}
        </>
      )}

      {post.error && <div className="error-box inline">{post.error}</div>}
      {error && <div className="error-box inline" role="alert">{error}</div>}

      {!editing && (
        <div className="actions">
          {post.status === "pending_approval" && <button className="action primary" disabled={!!busy} onClick={() => act("approve", () => patch({ status: "scheduled" }))}>Approve & schedule</button>}
          {post.status === "scheduled" && <button className="action" disabled={!!busy} onClick={() => act("hold", () => patch({ status: "pending_approval" }))}>Hold</button>}
          {!locked && <button className="action" disabled={!!busy} onClick={() => act("publish", () => api(`/api/posts/${post.id}/publish`, { method: "POST" }))}>{busy === "publish" ? "Publishing…" : post.status === "failed" ? "Retry now" : "Publish now"}</button>}
          {!locked && <button className="action" disabled={!!busy} onClick={() => { setDraft({ slides: post.slides, caption: post.caption, hashtags: post.hashtags.join(" "), when: toLocalInput(post.scheduledFor) }); setEditing(true); }}>Edit</button>}
          {post.status !== "publishing" && <button className="action danger" disabled={!!busy} onClick={() => confirm("Delete this post from Edyx? (Already-published posts stay on the platform.)") && act("delete", () => api(`/api/posts/${post.id}`, { method: "DELETE" }))}>Delete</button>}
        </div>
      )}
    </article>
  );
}

function QueuePanel({ posts, refresh }: { posts: Post[]; refresh: () => Promise<void> }) {
  const [filter, setFilter] = useState<"upcoming" | "published" | "all">("upcoming");
  const shown = posts
    .filter((p) => filter === "all" || (filter === "published" ? p.status === "published" : p.status !== "published"))
    .sort((a, b) => (filter === "upcoming" ? 1 : -1) * (Date.parse(a.scheduledFor) - Date.parse(b.scheduledFor)));
  return (
    <section className="queue">
      <div className="results-heading">
        <div><div className="step">02 / QUEUE</div><h2>What’s going out.</h2></div>
        <div className="segmented">
          {(["upcoming", "published", "all"] as const).map((f) => <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>{f}</button>)}
        </div>
      </div>
      {shown.length === 0 && <div className="empty-state small"><h2>Nothing here yet.</h2><p>Create a carousel or story, or turn on Autopilot to let the agent fill your calendar.</p></div>}
      {shown.map((post) => <PostCard key={`${post.id}-${post.status}`} post={post} refresh={refresh} />)}
    </section>
  );
}

function AutopilotPanel({ settings, setSettings, refresh }: { settings: AgentSettings; setSettings: (s: AgentSettings) => void; refresh: () => Promise<void> }) {
  const [form, setForm] = useState(() => ({ ...settings, pillarsText: settings.pillars.join("\n"), hoursText: settings.postingHours.join(", ") }));
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function save(overrides: Partial<AgentSettings> = {}) {
    const body = {
      ...form,
      pillars: form.pillarsText.split("\n").map((p) => p.trim()).filter(Boolean),
      postingHours: form.hoursText.split(/[\s,]+/).filter(Boolean).map(Number),
      timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
      ...overrides,
    };
    const { settings: saved } = await api<{ settings: AgentSettings }>("/api/agent", { method: "PUT", body: JSON.stringify(body) });
    setSettings(saved);
    setForm({ ...saved, pillarsText: saved.pillars.join("\n"), hoursText: saved.postingHours.join(", ") });
    return saved;
  }

  async function run(label: string, fn: () => Promise<string>) {
    setBusy(label);
    setMessage("");
    try {
      setMessage(await fn());
      await refresh();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Something went wrong.");
    } finally {
      setBusy("");
    }
  }

  const runNow = async () => {
    const result = await api<{ skipped: boolean; created: number; published: number; failed: number }>("/api/agent", { method: "POST" });
    return result.skipped ? "The agent is already running — check back in a minute." : `Agent run finished: ${result.created} created, ${result.published} published, ${result.failed} failed.`;
  };

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="workspace">
      <form className="brief-card" onSubmit={(e) => { e.preventDefault(); run("save", async () => { await save(); return "Settings saved."; }); }}>
        <div className="card-heading"><div><div className="step">03 / AUTOPILOT</div><h2>Teach the agent your brand.</h2></div><span className="sparkle">✳</span></div>
        <div className="field-row">
          <div><label htmlFor="brandName">Brand name</label><input id="brandName" value={form.brandName} onChange={(e) => set("brandName", e.target.value)} placeholder="Edyx Coffee" /></div>
          <div><label htmlFor="handle">Handle</label><input id="handle" value={form.handle} onChange={(e) => set("handle", e.target.value)} placeholder="@edyxcoffee" /></div>
        </div>
        <label htmlFor="description">What you sell, what makes it different, links & offers</label>
        <textarea id="description" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="The agent only uses facts you write here — include products, prices, offers, and your website." />
        <div className="field-row">
          <div><label htmlFor="audience">Audience</label><input id="audience" value={form.audience} onChange={(e) => set("audience", e.target.value)} placeholder="Busy city commuters" /></div>
          <div><label htmlFor="tone">Brand voice</label><select id="tone" value={form.tone} onChange={(e) => set("tone", e.target.value)}>{tones.map((t) => <option key={t}>{t}</option>)}</select></div>
        </div>
        <label htmlFor="pillars">Content pillars (one per line — the agent rotates through them)</label>
        <textarea id="pillars" className="short" value={form.pillarsText} onChange={(e) => set("pillarsText", e.target.value)} />
        <div className="field-row three">
          <div><label htmlFor="cpw">Carousels / week</label><input id="cpw" type="number" min={0} max={14} value={form.carouselsPerWeek} onChange={(e) => set("carouselsPerWeek", Number(e.target.value))} /></div>
          <div><label htmlFor="spd">Stories / day</label><input id="spd" type="number" min={0} max={10} value={form.storiesPerDay} onChange={(e) => set("storiesPerDay", Number(e.target.value))} /></div>
          <div><label htmlFor="hours">Posting hours</label><input id="hours" value={form.hoursText} onChange={(e) => set("hoursText", e.target.value)} placeholder="9, 13, 18" /></div>
        </div>
        <div className="platform-label">POST TO</div>
        <PlatformPicker value={form.platforms} onChange={(p) => set("platforms", p)} />
        <div className="platform-label">SLIDE COLORS</div>
        <div className="colors">
          {(["background", "text", "accent"] as const).map((key) => (
            <label key={key} className="color"><input type="color" value={form.theme[key]} onChange={(e) => set("theme", { ...form.theme, [key]: e.target.value })} />{key}</label>
          ))}
        </div>
        <label className="toggle">
          <input type="checkbox" checked={form.autoPublish} onChange={(e) => set("autoPublish", e.target.checked)} />
          <span><b>Auto-publish agent posts</b><br />Off = every post waits in the queue for your approval.</span>
        </label>
        <button className="submit" type="submit" disabled={!!busy}>{busy === "save" ? "Saving…" : "Save settings"}</button>
      </form>

      <div className="empty-state autopilot-card">
        <div className={`empty-icon ${settings.enabled ? "on" : ""}`}>{settings.enabled ? "●" : "❚❚"}</div>
        <div className="step">{settings.enabled ? "AUTOPILOT IS ON" : "AUTOPILOT IS PAUSED"}</div>
        <h2>{settings.enabled ? "Your agent is working." : "Ready when you are."}</h2>
        <p>
          {settings.enabled
            ? `Plans ${settings.carouselsPerWeek} carousel${settings.carouselsPerWeek === 1 ? "" : "s"} a week and ${settings.storiesPerDay} stor${settings.storiesPerDay === 1 ? "y" : "ies"} a day, about 3 days ahead, and ${settings.autoPublish ? "publishes them automatically" : "waits for your approval before publishing"}.`
            : "Turn it on and Edyx will keep your calendar filled with fresh carousels and stories."}
          {settings.lastRunAt && <><br /><small>Last run {new Date(settings.lastRunAt).toLocaleString()}</small></>}
        </p>
        <div className="actions">
          <button className="action primary" disabled={!!busy || (!settings.enabled && !form.brandName.trim())}
            title={!form.brandName.trim() ? "Add your brand name first" : undefined}
            onClick={() => run("toggle", async () => { const s = await save({ enabled: !settings.enabled }); return s.enabled ? "Autopilot is on. Run it now to fill your queue right away." : "Autopilot paused."; })}>
            {settings.enabled ? "Pause autopilot" : "Turn on autopilot"}
          </button>
          <button className="action" disabled={!!busy} onClick={() => run("run", runNow)}>{busy === "run" ? "Running…" : "Run agent now"}</button>
        </div>
        {message && <p className="notice">{message}</p>}
      </div>
    </div>
  );
}

function ActivityPanel({ log }: { log: { at: string; message: string }[] }) {
  return (
    <section className="draft-card activity">
      <div className="step">04 / ACTIVITY</div>
      <h2>What your agent has been up to.</h2>
      {log.length === 0 ? <p className="meta">No activity yet.</p> : (
        <ul>{log.map((entry, i) => <li key={i}><time>{new Date(entry.at).toLocaleString()}</time>{entry.message}</li>)}</ul>
      )}
    </section>
  );
}

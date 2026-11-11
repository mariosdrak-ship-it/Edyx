"use client";

import { FormEvent, useState } from "react";

type Draft = {
  platform: string;
  hook: string;
  caption: string;
  hashtags: string[];
  creativeIdea: string;
};

const platforms = ["Instagram", "TikTok"];

export default function Home() {
  const [brief, setBrief] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("Friendly and confident");
  const [selected, setSelected] = useState<string[]>(platforms);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function togglePlatform(platform: string) {
    setSelected((current) => current.includes(platform)
      ? current.filter((item) => item !== platform)
      : [...current, platform]);
  }

  async function createDrafts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setDrafts([]);
    setLoading(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, audience, tone, platforms: selected }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not create drafts.");
      setDrafts(result.drafts);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Edyx home"><span className="brand-mark">e</span> edyx</a>
        <span className="top-note"><span className="status-dot" /> YOUR CREATIVE COPILOT</span>
      </header>

      <section className="hero" id="home">
        <div className="eyebrow">SOCIAL, WITHOUT THE SPREADSHEET</div>
        <h1>Your ideas,<br /><span>ready for the feed.</span></h1>
        <p>Give Edyx the brief. Get tailored Instagram and TikTok post drafts, ready for your review.</p>
      </section>

      <div className="workspace">
        <form className="brief-card" onSubmit={createDrafts}>
          <div className="card-heading"><div><div className="step">01 / THE BRIEF</div><h2>What are we posting?</h2></div><span className="sparkle">✳</span></div>
          <label htmlFor="brief">Describe your product, offer, or idea</label>
          <textarea id="brief" required maxLength={3000} value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="Example: We just launched a reusable water bottle made for commuters. It keeps drinks cold all day and comes in three bright colors. We want to announce the launch and drive people to our shop." />
          <div className="field-row">
            <div className="field"><label htmlFor="audience">Who is it for?</label><input id="audience" value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="e.g. Busy city commuters" maxLength={160} /></div>
            <div className="field"><label htmlFor="tone">Brand voice</label><select id="tone" value={tone} onChange={(event) => setTone(event.target.value)}><option>Friendly and confident</option><option>Playful and witty</option><option>Expert and informative</option><option>Minimal and premium</option><option>Bold and energetic</option></select></div>
          </div>
          <div className="platform-label">MAKE DRAFTS FOR</div>
          <div className="platforms">{platforms.map((platform) => <button type="button" key={platform} className={`platform-chip ${selected.includes(platform) ? "selected" : ""}`} onClick={() => togglePlatform(platform)} aria-pressed={selected.includes(platform)}><span className="check">{selected.includes(platform) ? "✓" : "+"}</span>{platform}</button>)}</div>
          <button className="submit" type="submit" disabled={loading || !brief.trim() || selected.length === 0}>{loading ? <><span className="spinner" /> Creating your drafts…</> : <>Create post drafts <span aria-hidden="true">↗</span></>}</button>
          <p className="fine-print">AI-generated drafts are yours to edit and approve. Nothing is published automatically.</p>
        </form>

        <section className="results" aria-live="polite">
          {!drafts.length && !loading && <div className="empty-state"><div className="empty-icon">✳</div><div className="step">02 / YOUR CONTENT</div><h2>Your next post starts here.</h2><p>Share a brief and Edyx will shape it into platform-specific captions, hooks, hashtags, and creative ideas.</p><div className="preview-lines"><i /><i /><i /></div></div>}
          {loading && <div className="empty-state"><div className="spinner large" /><div className="step">WORKING ON IT</div><h2>Finding the right words.</h2><p>Putting your brief into shape for each platform…</p></div>}
          {error && <div className="error-box" role="alert"><strong>Couldn’t create drafts</strong><p>{error}</p></div>}
          {drafts.length > 0 && <><div className="results-heading"><div><div className="step">02 / YOUR CONTENT</div><h2>Made for your feed.</h2></div><span className="draft-count">{drafts.length} DRAFT{drafts.length === 1 ? "" : "S"}</span></div>{drafts.map((draft, index) => <article className="draft-card" key={`${draft.platform}-${index}`}><div className="draft-top"><span className="draft-platform">{draft.platform}</span><span className="draft-label">DRAFT · REVIEW BEFORE POSTING</span></div><h3>{draft.hook}</h3><p className="caption">{draft.caption}</p><p className="hashtags">{draft.hashtags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" ")}</p><div className="idea"><span>✦ CREATIVE IDEA</span><p>{draft.creativeIdea}</p></div><button className="copy-button" onClick={() => navigator.clipboard.writeText(`${draft.hook}\n\n${draft.caption}\n\n${draft.hashtags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" ")}`)}>Copy caption</button></article>)}</>}
        </section>
      </div>
      <footer><span>edyx</span><span>Make good things. Tell people.</span></footer>
    </main>
  );
}

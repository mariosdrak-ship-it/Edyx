import { promises as fs } from "fs";
import path from "path";
import type { AgentSettings, Store } from "./types";

const dataDir = process.env.EDYX_DATA_DIR || path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "edyx.json");

export const defaultSettings: AgentSettings = {
  enabled: false,
  autoPublish: true,
  brandName: "",
  handle: "",
  description: "",
  audience: "",
  tone: "Friendly and confident",
  pillars: ["Tips & how-tos", "Behind the scenes", "Product spotlight"],
  platforms: ["Instagram"],
  carouselsPerWeek: 3,
  storiesPerDay: 1,
  postingHours: [9, 13, 18],
  timezoneOffsetMinutes: 0,
  theme: { background: "#17231f", text: "#f7f8f3", accent: "#e9a76c" },
};

const emptyStore = (): Store => ({ settings: { ...defaultSettings }, posts: [], log: [] });

async function read(): Promise<Store> {
  try {
    const raw = JSON.parse(await fs.readFile(dataFile, "utf8")) as Partial<Store>;
    return {
      settings: { ...defaultSettings, ...raw.settings, theme: { ...defaultSettings.theme, ...raw.settings?.theme } },
      posts: raw.posts ?? [],
      log: raw.log ?? [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyStore();
    throw error;
  }
}

async function write(store: Store) {
  await fs.mkdir(dataDir, { recursive: true });
  const tmp = `${dataFile}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2));
  await fs.rename(tmp, dataFile);
}

// Serialize all access within this process so concurrent requests don't clobber each other.
// Kept on globalThis because Next.js may load this module in several bundles in one process.
const shared = globalThis as typeof globalThis & { __edyxQueue?: Promise<unknown> };
shared.__edyxQueue ??= Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const next = shared.__edyxQueue!.then(task);
  shared.__edyxQueue = next.catch(() => undefined);
  return next;
}

export function getStore(): Promise<Store> {
  return enqueue(read);
}

export function updateStore<T>(mutate: (store: Store) => T | Promise<T>): Promise<T> {
  return enqueue(async () => {
    const store = await read();
    const result = await mutate(store);
    store.log = store.log.slice(-200);
    await write(store);
    return result;
  });
}

export function logLine(store: Store, message: string) {
  store.log.push({ at: new Date().toISOString(), message });
}

export function newId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

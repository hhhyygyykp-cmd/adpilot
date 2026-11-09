"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useSession } from "./providers";

type Kind = "image" | "logo" | "video";

type Job = {
  id: string;
  kind: Kind;
  modelId: string;
  prompt: string;
  status: "queued" | "in_progress" | "completed" | "failed";
  requestId: string | null;
  mediaUrls: string[];
  costUsd: number;
  error: string | null;
};

type Budget = { limitUsd: number; spentUsd: number; remainingUsd: number };
type Payload = { job?: Job; jobs?: Job[]; budget: Budget };

const paths: Record<Kind, string> = {
  image: "/api/generate-image",
  logo: "/api/generate-logo",
  video: "/api/generate-video",
};

export function FalStudio({
  kinds = ["image", "logo", "video"],
  initialPrompt = "",
}: {
  kinds?: Kind[];
  initialPrompt?: string;
}) {
  const { t } = useSession();
  return (
    <section className="mt-10">
      <h2 className="serif text-3xl">{t("studio.title")}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{t("studio.intro")}</p>
      <div className="mt-5 grid gap-4">
        {kinds.map((kind) => (
          <Generator key={kind} kind={kind} initialPrompt={initialPrompt} />
        ))}
      </div>
    </section>
  );
}

function Generator({ kind, initialPrompt }: { kind: Kind; initialPrompt: string }) {
  const { t } = useSession();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [imageSize, setImageSize] = useState("square");
  const [duration, setDuration] = useState("5");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [history, setHistory] = useState<Job[]>([]);
  const [budget, setBudget] = useState<Budget | null>(null);

  useEffect(() => {
    let cancel = false;
    api<Payload>(paths[kind])
      .then((data) => {
        if (cancel) return;
        setHistory(data.jobs ?? []);
        setBudget(data.budget);
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [kind]);

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const body: Record<string, unknown> = { prompt };
      if (kind !== "video") body.imageSize = imageSize;
      if (kind === "video") {
        body.duration = duration;
        body.aspectRatio = aspectRatio;
      }
      let data = await api<Payload>(paths[kind], { method: "POST", body: JSON.stringify(body) });
      let current = data.job ?? null;
      setJob(current);
      setBudget(data.budget);
      let attempts = 0;
      while (current?.requestId && current.status !== "completed" && current.status !== "failed" && attempts < 40) {
        await delay(3000);
        data = await poll(paths[kind], current.requestId);
        current = data.job ?? current;
        setJob(current);
        setBudget(data.budget);
        attempts += 1;
      }
      if (current?.status === "failed") setError(current.error || t("common.error"));
      const fresh = await api<Payload>(paths[kind]);
      setHistory(fresh.jobs ?? []);
      setBudget(fresh.budget);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel rounded-3xl p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs uppercase tracking-[0.18em] text-[var(--gold)]">{t(`studio.${kind}`)}</h3>
        {budget ? (
          <p className="text-xs text-[var(--muted)]">
            {t("studio.budget")} ${budget.spentUsd.toFixed(3)} / ${budget.limitUsd.toFixed(2)} · $
            {budget.remainingUsd.toFixed(3)} {t("studio.remaining")}
          </p>
        ) : null}
      </div>
      {kind === "logo" ? <p className="mt-2 text-xs text-[var(--muted)]">{t("studio.logoNote")}</p> : null}
      <label className="mt-3 block text-sm">
        {t("studio.prompt")}
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={3}
          className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-black/20 px-4 py-3"
        />
      </label>
      {kind !== "video" ? (
        <label className="mt-3 block text-sm">
          {t("studio.size")}
          <select
            value={imageSize}
            onChange={(event) => setImageSize(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-black/20 px-4 py-3"
          >
            <option value="square">{t("studio.square")}</option>
            <option value="square_hd">square_hd</option>
            <option value="landscape_4_3">landscape_4_3</option>
            <option value="landscape_16_9">landscape_16_9</option>
            <option value="portrait_4_3">portrait_4_3</option>
            <option value="portrait_16_9">portrait_16_9</option>
          </select>
        </label>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            {t("studio.duration")}
            <select
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-black/20 px-4 py-3"
            >
              <option value="5">5s</option>
              <option value="10">10s</option>
            </select>
          </label>
          <label className="text-sm">
            {t("studio.ratio")}
            <select
              value={aspectRatio}
              onChange={(event) => setAspectRatio(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-black/20 px-4 py-3"
            >
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
              <option value="1:1">1:1</option>
            </select>
          </label>
        </div>
      )}
      <button
        type="button"
        disabled={busy || prompt.trim().length < 1}
        onClick={() => void generate()}
        className="mt-4 rounded-full bg-[var(--gold)] px-5 py-2.5 text-sm font-medium text-[var(--ink)] disabled:opacity-40"
      >
        {busy ? t("studio.working") : t("studio.generate")}
      </button>
      {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
      {job ? <JobView job={job} /> : null}
      {history.length ? (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{t("studio.history")}</p>
          <div className="mt-2 grid gap-3">
            {history.map((item) => (
              <JobView key={item.id} job={item} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function JobView({ job }: { job: Job }) {
  return (
    <article className="mt-3 text-sm">
      <p className="text-xs text-[var(--muted)]">
        {job.status} · {job.modelId}
        {job.requestId ? ` · ${job.requestId}` : ""} · ${job.costUsd.toFixed(3)}
      </p>
      {job.mediaUrls.map((url) =>
        job.kind === "video" ? (
          <video key={url} src={url} controls playsInline className="mt-2 w-full rounded-2xl" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={url} src={url} alt={job.prompt} className="mt-2 w-full rounded-2xl" />
        ),
      )}
    </article>
  );
}

async function poll(path: string, requestId: string): Promise<Payload> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await api<Payload>(`${path}?requestId=${encodeURIComponent(requestId)}`);
    } catch (error) {
      last = error;
      await delay(500 * (attempt + 1));
    }
  }
  throw last instanceof Error ? last : new Error("Status check failed");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

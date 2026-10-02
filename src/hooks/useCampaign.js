import { useEffect, useState } from 'react';
import { campaign as campaignApi } from '../api/endpoints';

// The server is authoritative on whether the Dashain campaign is active and
// when it ends; this hook only reads and displays that fixed window. Shared
// across the banner, homepage section, and cart so there is one fetch, not
// several independent copies of "is the campaign on".
let cached = null;
let inflight = null;

// setTimeout silently fires almost immediately once its delay exceeds the
// 32-bit signed int max (~24.8 days) instead of waiting: a campaign window
// further out than that would make the boundary timer below refetch in a
// tight infinite loop. Cap it and just re-check again before the real
// boundary; refresh() recomputes `next` every time, so this still converges.
const MAX_TIMEOUT_MS = 2_147_483_647;

function load(force = false) {
  if (cached && !force) return Promise.resolve(cached);
  if (!inflight) {
    inflight = campaignApi
      .dashain()
      .then((r) => {
        cached = r.data;
        return cached;
      })
      .catch(() => null)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** The raw campaign record ({ code, name, active, starts_at, ends_at, ... }) or null while loading. */
export function useCampaign() {
  const [data, setData] = useState(cached);
  useEffect(() => {
    let live = true;
    let boundaryTimer;
    const refresh = (force = false) => load(force).then((c) => {
      if (!live) return;
      setData(c);
      const start = new Date(c?.starts_at).getTime();
      const end = new Date(c?.ends_at).getTime();
      const next = [start, end].find((time) => Number.isFinite(time) && time > Date.now());
      if (next) boundaryTimer = window.setTimeout(() => refresh(true), Math.min(Math.max(next - Date.now() + 25, 25), MAX_TIMEOUT_MS));
    });
    refresh();
    return () => {
      live = false;
      if (boundaryTimer) window.clearTimeout(boundaryTimer);
    };
  }, []);
  return data;
}

function timeLeft(endAt) {
  const seconds = Math.max(0, Math.floor((new Date(endAt).getTime() - Date.now()) / 1000));
  return {
    seconds,
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    secs: seconds % 60,
  };
}

/** Display-only per-second countdown to the server's fixed campaign end. Ticks locally; never decides eligibility. */
export function useCampaignCountdown() {
  const campaign = useCampaign();
  const [left, setLeft] = useState(null);

  useEffect(() => {
    if (!campaign?.active) {
      setLeft(null);
      return undefined;
    }
    const update = () => setLeft(timeLeft(campaign.ends_at));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [campaign]);

  return { campaign, left: left && left.seconds > 0 ? left : null };
}

import { readFileSync } from "node:fs";
import net from "node:net";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function readResolvNameserver({ readFile = readFileSync } = {}) {
  try {
    const text = readFile("/etc/resolv.conf", "utf8");
    const m = String(text).match(/^\s*nameserver\s+(\S+)/m);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export function readMirroredHint({ readFile = readFileSync } = {}) {
  try {
    const text = readFile("/etc/wsl.conf", "utf8");
    if (/networkingMode\s*=\s*mirrored/i.test(text)) return "mirrored";
  } catch {
    /* optional */
  }
  return null;
}

/** Build http:// candidate bases (no trailing slash, no port). */
export function candidateBases({
  nameserver = null,
  mirrored = null,
  extras = [],
} = {}) {
  const set = new Set(["http://127.0.0.1", "http://localhost"]);
  if (nameserver && net.isIP(nameserver)) {
    set.add(`http://${nameserver}`);
  }
  if (mirrored === "mirrored") {
    // Mirrored networking: loopback is shared; keep 127.0.0.1 first.
    set.add("http://127.0.0.1");
  }
  for (const e of extras) {
    const u = String(e || "").replace(/\/$/, "");
    if (/^https?:\/\//i.test(u)) set.add(u);
  }
  return [...set];
}

export function tcpConnect(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, family: 4 });
    let done = false;
    const finish = (ok, error) => {
      if (done) return;
      done = true;
      try { socket.destroy(); } catch { /* ignore */ }
      resolve({ ok, error });
    };
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => finish(true));
    socket.on("timeout", () => finish(false, "timeout"));
    socket.on("error", (err) => finish(false, err.message));
  });
}

export async function fetchPath(baseURL, path, timeoutMs = 1500) {
  const url = `${baseURL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal });
    const text = await res.text();
    return { ok: res.ok, status: res.status, bytes: text.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(t);
  }
}

export function parseHostPort(baseURL) {
  try {
    const u = new URL(baseURL.includes("://") ? baseURL : `http://${baseURL}`);
    return { host: u.hostname, port: u.port ? Number(u.port) : (u.protocol === "https:" ? 443 : 80) };
  } catch {
    return null;
  }
}

export async function probeCandidate(base, port, { timeoutMs = 1500, path = null } = {}) {
  const host = base.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  const tcp = await tcpConnect(host, port, timeoutMs);
  const result = {
    baseURL: `${base.replace(/\/$/, "")}:${port}`,
    host,
    port,
    tcp: tcp.ok,
    tcpError: tcp.error,
  };
  if (path) {
    const http = await fetchPath(`${base.replace(/\/$/, "")}:${port}`, path, timeoutMs);
    result.http = http;
  } else if (port === 11434) {
    const http = await fetchPath(`${base.replace(/\/$/, "")}:${port}`, "/api/tags", timeoutMs);
    result.http = http;
    result.ollama = Boolean(http.ok);
  }
  result.ok = Boolean(tcp.ok || result.http?.ok);
  return result;
}

export function buildHostReachAdvice(report) {
  const tips = [];
  const good = (report.probes || []).filter((p) => p.ok);
  if (good.length) {
    tips.push(`Working baseURL: ${good[0].baseURL}`);
    tips.push(
      "In DSH settings.yaml (openai-compatible / Ollama), set baseURL to the working value above (e.g. http://127.0.0.1:11434).",
    );
    if (good.some((p) => p.ollama)) {
      tips.push("Ollama /api/tags responded — provider can use that baseURL.");
    }
  } else {
    tips.push("No candidate reached the service. Start Ollama on Windows, or check firewall / mirrored networking.");
    tips.push("Try networkingMode=mirrored in %UserProfile%\\.wslconfig, then wsl --shutdown.");
    tips.push("For NAT mode, use the Windows host IP from /etc/resolv.conf nameserver as the base host.");
  }
  if (report.mirrored) tips.push("Detected mirrored networking hint in /etc/wsl.conf.");
  if (report.nameserver) tips.push(`resolv.conf nameserver: ${report.nameserver}`);
  return tips;
}

export function formatHostReachReport(report) {
  const lines = ["host_reach"];
  if (report.error) lines.push(`error: ${report.error}`);
  for (const p of report.probes || []) {
    lines.push(
      `${p.baseURL}: tcp=${p.tcp}${p.http ? ` http=${p.http.ok}` : ""}${p.ollama ? " ollama=yes" : ""}`,
    );
  }
  for (const tip of report.advice || []) lines.push(`- ${tip}`);
  return lines.join("\n");
}

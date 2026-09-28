import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isAbsolute } from "node:path";

const execute = promisify(execFile);

export async function notifySystemd(message: string, socketPath = process.env.NOTIFY_SOCKET): Promise<void> {
  if (!socketPath || process.platform !== "linux") return;
  const abstract = socketPath.startsWith("@");
  if (!abstract && !isAbsolute(socketPath)) return;
  const args = message.split("\n").flatMap((field) => {
    if (field === "READY=1") return ["--ready"];
    if (field === "STOPPING=1") return ["--stopping"];
    if (field.startsWith("STATUS=") && field.length <= 512) return [`--status=${field.slice(7)}`];
    if (field === "WATCHDOG=1") return ["WATCHDOG=1"];
    return [];
  });
  if (!args.length) return;
  try { await execute("systemd-notify", [...args, `--pid=${process.pid}`], { timeout: 2_000, windowsHide: true }); } catch { /* systemd notification is best-effort */ }
}

export function startSystemdWatchdog() {
  const usec = Number(process.env.WATCHDOG_USEC ?? 0);
  const watchdogPid = Number(process.env.WATCHDOG_PID ?? process.pid);
  if (!Number.isSafeInteger(usec) || usec <= 0 || watchdogPid !== process.pid) return () => undefined;
  const timer = setInterval(() => { void notifySystemd("WATCHDOG=1"); }, Math.max(1_000, Math.floor(usec / 2_000)));
  timer.unref();
  return () => clearInterval(timer);
}
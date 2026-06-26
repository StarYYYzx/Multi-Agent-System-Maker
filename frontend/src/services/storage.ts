/* LocalStorage 蓝图与日志 CRUD */

import type { WorkflowBlueprint } from "../engine/types";

const BLUEPRINTS_KEY = "masm_blueprints";
const LOGS_KEY = "masm_logs";

// === 蓝图管理 ===
export function loadBlueprints(): WorkflowBlueprint[] {
  const raw = localStorage.getItem(BLUEPRINTS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveBlueprint(bp: WorkflowBlueprint): void {
  const list = loadBlueprints();
  const idx = list.findIndex((b) => b.id === bp.id);
  if (idx >= 0) list[idx] = bp;
  else list.push(bp);
  localStorage.setItem(BLUEPRINTS_KEY, JSON.stringify(list));
}

export function deleteBlueprint(id: string): void {
  const list = loadBlueprints().filter((b) => b.id !== id);
  localStorage.setItem(BLUEPRINTS_KEY, JSON.stringify(list));
}

export function getBlueprint(id: string): WorkflowBlueprint | undefined {
  return loadBlueprints().find((b) => b.id === id);
}

// === 日志管理 ===
export function loadLogs(): unknown[] {
  const raw = localStorage.getItem(LOGS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveLog(log: unknown): void {
  const list = loadLogs();
  list.unshift(log);
  localStorage.setItem(LOGS_KEY, JSON.stringify(list));
}

export function getLog(logId: string): unknown | undefined {
  return loadLogs().find((l: any) => l.logId === logId);
}

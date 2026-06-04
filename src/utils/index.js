import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

export function generateFIRId() {
  const year = new Date().getFullYear();
  const seq  = String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0");
  return `TN001/${year}/${seq}`;
}

// LocalStorage helpers
export function saveToStorage(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); return true; }
  catch { return false; }
}

export function loadFromStorage(key, fallback = null) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}

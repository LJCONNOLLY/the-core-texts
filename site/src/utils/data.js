const BASE = import.meta.env.BASE_URL + 'data/';
const cache = {};

async function fetchJSON(path) {
  if (cache[path]) return cache[path];
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  const data = await res.json();
  cache[path] = data;
  return data;
}

export async function loadIndex() {
  return fetchJSON('index.json');
}

export async function loadBook(id) {
  return fetchJSON(`books/${id}.json`);
}

export async function loadGlossaryConfig() {
  const res = await fetch(import.meta.env.BASE_URL + '../glossary.json');
  if (!res.ok) return { terms: [] };
  return res.json();
}

export async function loadFrameworksConfig() {
  const res = await fetch(import.meta.env.BASE_URL + '../frameworks.json');
  if (!res.ok) return { frameworks: [] };
  return res.json();
}

export function getCachedAI(key) {
  try {
    const stored = localStorage.getItem(`coretexts-ai-${key}`);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function setCachedAI(key, data) {
  localStorage.setItem(`coretexts-ai-${key}`, JSON.stringify(data));
}

export function getApiKey() {
  return localStorage.getItem('coretexts-api-key') || '';
}

export function setApiKey(key) {
  localStorage.setItem('coretexts-api-key', key);
}

export function getNotes(bookId) {
  return localStorage.getItem(`coretexts-notes-${bookId}`) || '';
}

export function setNotes(bookId, text) {
  localStorage.setItem(`coretexts-notes-${bookId}`, text);
}

import Anthropic from '@anthropic-ai/sdk';
import { getApiKey, getCachedAI, setCachedAI } from './data';

function getClient() {
  const key = getApiKey();
  if (!key) throw new Error('No API key configured. Set your key in Settings.');
  return new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
}

export async function generateBookArguments(book, bookText) {
  const cacheKey = `arguments-${book.id}`;
  const cached = getCachedAI(cacheKey);
  if (cached) return cached;

  const client = getClient();
  const textSample = bookText.pages
    .slice(0, 20)
    .map(p => p.text)
    .join('\n\n')
    .slice(0, 15000);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `You are a digital humanities scholar. Based on this excerpt from "${book.title}" by ${(book.author || []).join(', ')} (${book.year || 'n.d.'}), identify 3-5 key arguments the author makes. For each argument provide a one-sentence summary and a 2-3 sentence elaboration. Return as JSON array: [{"summary": "...", "elaboration": "..."}]\n\nText:\n${textSample}`
    }]
  });

  const text = response.content[0].text;
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  const result = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  setCachedAI(cacheKey, result);
  return result;
}

export async function generateGlossaryEntry(term, passages) {
  const cacheKey = `glossary-${term}`;
  const cached = getCachedAI(cacheKey);
  if (cached) return cached;

  const client = getClient();
  const excerpts = passages.slice(0, 10).map(p =>
    `From "${p.book}" by ${p.author}: "${p.excerpt}"`
  ).join('\n\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `You are creating a glossary for a PhD comprehensive exam reading list in digital humanities, critical race/feminist technology studies, and rhetoric/technical communication.\n\nTerm: "${term}"\n\nPassages from the reading list:\n${excerpts}\n\nProvide a JSON object with: {"definition": "2-3 sentence synthesized definition", "usage_notes": "How different scholars use this term differently", "related_terms": ["list of related concepts"]}`
    }]
  });

  const text = response.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { definition: text, usage_notes: '', related_terms: [] };
  setCachedAI(cacheKey, result);
  return result;
}

export async function generateFrameworkSummary(framework, books, passages) {
  const cacheKey = `framework-${framework}`;
  const cached = getCachedAI(cacheKey);
  if (cached) return cached;

  const client = getClient();
  const context = passages.slice(0, 10).map(p =>
    `From "${p.book}" by ${p.author}: "${p.excerpt}"`
  ).join('\n\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `Summarize how the theoretical framework "${framework}" is used across these texts from a PhD reading list. Which scholars engage with it and how?\n\nPassages:\n${context}\n\nBooks that engage: ${books.join(', ')}\n\nReturn JSON: {"summary": "paragraph summary", "key_concepts": ["list"], "key_scholars": ["list"]}`
    }]
  });

  const text = response.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: text, key_concepts: [], key_scholars: [] };
  setCachedAI(cacheKey, result);
  return result;
}

export async function generateSynthesis(textDefs, techDefs) {
  const cacheKey = 'synthesis';
  const cached = getCachedAI(cacheKey);
  if (cached) return cached;

  const client = getClient();
  const textExcerpts = textDefs.slice(0, 15).map(d =>
    `${d.author}, "${d.book}" (p.${d.locator}): "${d.excerpt}"`
  ).join('\n');
  const techExcerpts = techDefs.slice(0, 15).map(d =>
    `${d.author}, "${d.book}" (p.${d.locator}): "${d.excerpt}"`
  ).join('\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `These passages define or discuss "text" and "technology" from a PhD reading list.\n\nDefinitions of "text":\n${textExcerpts}\n\nDefinitions of "technology":\n${techExcerpts}\n\nWrite a comparative synthesis in scholarly prose:\n1. How "text" is defined across the corpus\n2. How "technology" is defined\n3. Where definitions converge and diverge\n\nReturn JSON: {"text_synthesis": "...", "technology_synthesis": "...", "comparative": "..."}`
    }]
  });

  const text = response.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { text_synthesis: text, technology_synthesis: '', comparative: '' };
  setCachedAI(cacheKey, result);
  return result;
}

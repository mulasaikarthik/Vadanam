// Supabase Edge Function: gemini-chat
// Securely proxies the team AI Mentor to the Gemini API.
//
// Security model:
//  - GEMINI_API_KEY is read ONLY from server-side secrets (never sent to client).
//  - The caller must present a valid Supabase user JWT (verify_jwt is on by
//    default AND we re-validate with auth.getUser()).
//  - The user ID comes from the JWT — never from the request body.
//  - Team membership is checked through the caller's own RLS-scoped client.
//  - The user's message is inserted with the caller's JWT (RLS: role='user',
//    user_id = auth.uid()). The AI reply is inserted with the service role
//    (RLS intentionally blocks clients from writing role='ai').
//  - Error messages returned to the client never contain keys or raw
//    upstream payloads.

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_MESSAGE_CHARS = 4000;
const MAX_HISTORY_MESSAGES = 16;
const MAX_OUTPUT_TOKENS = 1024;
// Primary model per current API guidance, with verified fallbacks.
const MODELS = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-3.7-flash"];

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Simple per-user rate limit (per warm isolate): max 8 requests / minute.
const RATE_LIMIT = 8;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const list = (hits.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (list.length >= RATE_LIMIT) { hits.set(userId, list); return true; }
  list.push(now);
  hits.set(userId, list);
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });

  // ---- secrets (server-side only) ----
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!GEMINI_API_KEY || !SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    console.error("gemini-chat: missing server configuration");
    return json(500, { error: "The AI mentor is not configured yet. Ask your admin to set the server secret." });
  }

  // ---- input validation ----
  let teamId = "", message = "";
  try {
    const body = await req.json();
    teamId = String(body?.teamId ?? "");
    message = String(body?.message ?? "").trim();
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }
  if (!UUID_RE.test(teamId)) return json(400, { error: "Invalid team id." });
  if (!message) return json(400, { error: "Message is empty." });
  if (message.length > MAX_MESSAGE_CHARS) {
    return json(400, { error: `Message too long (max ${MAX_MESSAGE_CHARS} characters).` });
  }

  // ---- authenticate the caller (user id from JWT, never from the body) ----
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json(401, { error: "Sign in to use the AI mentor." });
  const userId = userData.user.id;

  if (rateLimited(userId)) {
    return json(429, { error: "Slow down a little — the mentor allows 8 questions per minute." });
  }

  // ---- authorize: caller must be a member of this team (via their own RLS) ----
  const { data: membership, error: memErr } = await userClient
    .from("team_members")
    .select("team_id")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .maybeSingle();
  if (memErr || !membership) return json(403, { error: "You are not a member of this team." });

  // ---- gather project context + recent history (RLS-scoped reads) ----
  const [{ data: team }, { data: history }] = await Promise.all([
    userClient.from("teams")
      .select("name, hackathon, problem_statement, description")
      .eq("id", teamId).maybeSingle(),
    userClient.from("mentor_messages")
      .select("role, body")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(MAX_HISTORY_MESSAGES),
  ]);

  // ---- persist the user's message (as the user; RLS enforces role='user') ----
  const { error: insErr } = await userClient.from("mentor_messages").insert({
    team_id: teamId, user_id: userId, role: "user", body: message,
  });
  if (insErr) {
    console.error("gemini-chat: user insert failed:", insErr.message);
    return json(500, { error: "Couldn't save your message. Try again." });
  }

  // ---- build the Gemini request ----
  const systemPrompt =
    `You are the AI Hackathon Mentor inside "Hackathon Command Center", a workspace for hackathon teams. ` +
    `Be concise, concrete and deadline-aware. Prefer actionable steps over theory. ` +
    `Use markdown: short paragraphs, bullet lists, and fenced code blocks for code. Keep answers under 300 words unless code requires more.\n\n` +
    `Team context:\n` +
    `- Team: ${team?.name ?? "Unknown"}\n` +
    `- Hackathon: ${team?.hackathon || "not specified"}\n` +
    `- Problem statement: ${team?.problem_statement || "not provided yet — encourage the team to add it in Settings"}\n` +
    `- Project description: ${team?.description || "none"}`;

  const contents = (history ?? [])
    .reverse()
    .map((m: { role: string; body: string }) => ({
      role: m.role === "ai" ? "model" : "user",
      parts: [{ text: m.body.slice(0, MAX_MESSAGE_CHARS) }],
    }));
  contents.push({ role: "user", parts: [{ text: message }] });

  const payload = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.7 },
  };

  // ---- call Gemini with model fallback on 404/429/503 ----
  let reply = "";
  let lastStatus = 0;
  for (const model of MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      lastStatus = res.status;
      if (res.ok) {
        const data = await res.json();
        reply = (data?.candidates?.[0]?.content?.parts ?? [])
          .map((p: { text?: string }) => p.text ?? "")
          .join("")
          .trim();
        if (reply) break;
      } else {
        // log server-side only; never forward upstream bodies to the client
        console.error(`gemini-chat: ${model} -> HTTP ${res.status}`);
        if (![404, 429, 500, 503].includes(res.status)) break; // non-retryable
      }
    } catch (e) {
      console.error(`gemini-chat: ${model} fetch failed:`, (e as Error).message);
    }
  }

  if (!reply) {
    const friendly =
      lastStatus === 429
        ? "The AI mentor hit its rate limit — wait a minute and try again."
        : lastStatus === 503
          ? "The AI model is overloaded right now — try again in a moment."
          : "The AI mentor couldn't respond right now. Try again shortly.";
    return json(502, { error: friendly });
  }

  // ---- persist the AI reply (service role; clients can't write role='ai') ----
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { error: aiErr } = await adminClient.from("mentor_messages").insert({
    team_id: teamId, user_id: null, role: "ai", body: reply.slice(0, 16000),
  });
  if (aiErr) console.error("gemini-chat: ai insert failed:", aiErr.message);

  return json(200, { reply });
});

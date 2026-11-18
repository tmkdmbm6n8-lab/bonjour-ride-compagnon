import { createOpenAI } from '@ai-sdk/openai';
import { streamText, Output, jsonSchema, APICallError } from 'ai';
import { parseSupportThread } from './vtc-support';
import { ASSIST_INSTRUCTIONS, ASSIST_MODEL, ASSIST_SCHEMA, assistErrorMessage, buildAssistInput, normalizeAssist } from './support-assist.js';

const GATEWAY = 'https://ai.gateway.lovable.dev/v1';
const RUN_ID_HEADER = 'X-Lovable-AIG-Run-ID';

function runIdFetch() {
  let runId;
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    if (runId && !headers.has(RUN_ID_HEADER)) headers.set(RUN_ID_HEADER, runId);
    const response = await fetch(input, { ...init, headers });
    runId ??= response.headers.get(RUN_ID_HEADER)?.trim() || undefined;
    return response;
  };
}

function statusOf(error) {
  if (APICallError.isInstance(error)) return error.statusCode;
  if (error?.cause && APICallError.isInstance(error.cause)) return error.cause.statusCode;
  return error?.statusCode;
}

// Analyse à la demande : rien n'est enregistré, rien n'est envoyé à l'utilisateur.
export async function supportAssist(admin, id) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error(assistErrorMessage(401));
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ''))) throw new Error('Message invalide');
  const { data: row, error } = await admin.from('contact_messages').select('id,topic,message,created_at').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row || ['ride_chat_archive', 'ride_chat_cleanup'].includes(row.topic)) throw new Error('Message introuvable');
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { 'Lovable-API-Key': apiKey, 'X-Lovable-AIG-SDK': 'vercel-ai-sdk' },
    fetch: runIdFetch(),
  });
  let failure;
  const result = streamText({
    model: provider.responses(ASSIST_MODEL),
    instructions: ASSIST_INSTRUCTIONS,
    messages: [{ role: 'user', content: buildAssistInput(row, parseSupportThread(row)) }],
    output: Output.object({ schema: jsonSchema(ASSIST_SCHEMA) }),
    maxRetries: 0,
    onError: ({ error: e }) => { failure = e; },
    providerOptions: {
      openai: { forceReasoning: true, reasoningEffort: 'low', reasoningSummary: 'auto', store: false, include: ['reasoning.encrypted_content'] },
    },
  });
  try {
    const output = await result.output;
    const clean = normalizeAssist(output);
    if (!clean.suggestedReply) throw new Error(assistErrorMessage(500));
    return { assist: clean };
  } catch (e) {
    const status = statusOf(failure) ?? statusOf(e);
    console.error('support assist failed', status, (failure || e)?.message);
    throw new Error(assistErrorMessage(status));
  }
}

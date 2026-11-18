import { newSupportThread, parseSupportThread, supportOwnedBy, supportShape, supportHiddenForOwner } from "./vtc-support";
function required(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
export async function inboxForDriver(admin, uid, email, page = 1) {
  const start = (Math.max(1, Number(page) || 1) - 1) * 50;
  const escapedEmail = String(email || "").replace(/[\\%_]/g, "\\$&");
  const [support, owned] = await Promise.all([
    email
      ? admin
          .from("contact_messages")
          .select("*")
          .ilike("email", escapedEmail)
          .order("created_at", { ascending: false })
          .range(start, start + 49)
      : { data: [] },
    admin
      .from("contact_messages")
      .select("*")
      .eq("topic", "driver_conversation")
      .like("message", '%"userId":"' + uid + '"%')
      .order("created_at", { ascending: false })
      .range(start, start + 49),
  ]);
  const rows = [
    ...new Map([...required(support), ...required(owned)].map((row) => [row.id, row])).values(),
  ].filter((row) => supportOwnedBy(row, uid, email));
  return {
    threads: rows.filter((row) => !supportHiddenForOwner(row)).map(supportShape),
    rides: [],
    hasMore:
      (support.data?.length || 0) === 50 ||
      (owned.data?.length || 0) === 50,
  };
}
export async function sendSupportMessage(admin, { uid, email, name, role, body }) {
  if (!["driver", "rider", "admin"].includes(role)) throw new Error("Accès refusé");
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 4000)
    throw new Error("Le message doit contenir entre 1 et 4 000 caractères");
  if (!body.id) {
    if (!["driver", "rider"].includes(role) || !email)
      throw new Error("Compte et adresse e-mail requis");
    const thread = newSupportThread(uid, body.subject, text, new Date().toISOString(), role);
    const row = required(
      await admin
        .from("contact_messages")
        .insert({
          name: name || (role === "driver" ? "Chauffeur" : "Utilisateur"),
          email: email.toLowerCase(),
          topic: "driver_conversation",
          message: JSON.stringify(thread),
        })
        .select("*")
        .single(),
    );
    return { thread: supportShape(row) };
  }
  if (!/^[0-9a-f-]{36}$/i.test(body.id)) throw new Error("Conversation invalide");
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = required(
      await admin.from("contact_messages").select("*").eq("id", body.id).single(),
    );
    if (role !== "admin" && !supportOwnedBy(row, uid, email))
      throw new Error("Conversation inaccessible");
    const thread = parseSupportThread(row);
    if (thread.messages.length >= 500)
      throw new Error("Cette conversation est pleine. Ouvrez une nouvelle demande.");
    thread.messages.push({
      id: crypto.randomUUID(),
      from: role === "admin" ? "admin" : role,
      text,
      createdAt: new Date().toISOString(),
    });
    const updated = required(
      await admin
        .from("contact_messages")
        .update({
          topic: "driver_conversation",
          message: JSON.stringify(thread),
          status: "open",
          resolved_at: null,
        })
        .eq("id", row.id)
        .eq("message", row.message)
        .select("*"),
    );
    if (updated.length) return { thread: supportShape(updated[0]) };
  }
  throw new Error("Un autre message vient d’arriver. Réessayez l’envoi.");
}
/** Authenticated support for both clients and drivers, with ownership rechecked after lookup. */
export async function personalSupportRequests(admin, uid, email, page = 0) {
  if (!Number.isSafeInteger(page) || page < 0 || page > 100000) throw new Error("Page invalide");
  const start = page * 25;
  const escapedEmail = String(email || "").replace(/[\\%_]/g, "\\$&");
  const fields = "id,name,email,topic,message,status,created_at,resolved_at";
  const [byEmail, byUser] = await Promise.all([
    email
      ? admin
          .from("contact_messages")
          .select(fields)
          .ilike("email", escapedEmail)
          .order("created_at", { ascending: false })
          .range(start, start + 24)
      : { data: [], error: null },
    admin
      .from("contact_messages")
      .select(fields)
      .eq("topic", "driver_conversation")
      .like("message", '%"userId":"' + uid + '"%')
      .order("created_at", { ascending: false })
      .range(start, start + 24),
  ]);
  const rows = [
    ...new Map([...required(byEmail), ...required(byUser)].map((row) => [row.id, row])).values(),
  ].filter((row) => supportOwnedBy(row, uid, email));
  return {
    requests: rows
      .map(supportShape)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    hasMore: byEmail.data.length === 25 || byUser.data.length === 25,
  };
}

export async function hideDriverSupportThread(admin, { uid, email, id, expectedUpdatedAt }) {
  if (!/^[0-9a-f-]{36}$/i.test(id || '')) throw new Error('Conversation invalide');
  for (let attempt=0;attempt<3;attempt++) {
    const row=required(await admin.from('contact_messages').select('*').eq('id',id).single());
    if(!row || !supportOwnedBy(row,uid,email))throw new Error('Conversation inaccessible');
    if(expectedUpdatedAt && supportShape(row).updatedAt !== expectedUpdatedAt)
      throw new Error('Un nouveau message est arrivé. Relisez la conversation avant de la supprimer.');
    const thread=parseSupportThread(row);
    if(!thread.messages.length)throw new Error('Conversation vide');
    const value={...thread,userId:thread.userId || uid,hiddenThroughMessageId:thread.messages.at(-1).id};
    const result=required(await admin.from('contact_messages').update({topic:'driver_conversation',message:JSON.stringify(value)}).eq('id',id).eq('message',row.message).select('id'));
    if(result.length)return {ok:true};
  }
  throw new Error('La conversation a changé. Réessayez.');
}

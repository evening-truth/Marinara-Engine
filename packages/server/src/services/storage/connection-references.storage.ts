import { eq } from "drizzle-orm";
import type { DB } from "../../db/connection.js";
import { agentConfigs, apiConnections, chats } from "../../db/schema/index.js";
import { now } from "../../utils/id-generator.js";

export type ConnectionReferences = {
  agents: Array<{ id: string; name: string; type: string }>;
  chats: Array<{ id: string; name: string; mode: string }>;
};

export function hasConnectionReferences(references: ConnectionReferences): boolean {
  return references.agents.length > 0 || references.chats.length > 0;
}

export async function listConnectionReferences(db: DB, connectionId: string): Promise<ConnectionReferences> {
  const [agentRows, chatRows] = await Promise.all([
    db
      .select({ id: agentConfigs.id, name: agentConfigs.name, type: agentConfigs.type })
      .from(agentConfigs)
      .where(eq(agentConfigs.connectionId, connectionId)),
    db
      .select({ id: chats.id, name: chats.name, mode: chats.mode })
      .from(chats)
      .where(eq(chats.connectionId, connectionId)),
  ]);

  return {
    agents: agentRows,
    chats: chatRows,
  };
}

export async function deleteConnectionIfUnreferenced(
  db: DB,
  connectionId: string,
): Promise<{ deleted: true; references: ConnectionReferences } | { deleted: false; references: ConnectionReferences }> {
  return db.transaction(async (tx) => {
    const [agentRows, chatRows] = await Promise.all([
      tx
        .select({ id: agentConfigs.id, name: agentConfigs.name, type: agentConfigs.type })
        .from(agentConfigs)
        .where(eq(agentConfigs.connectionId, connectionId)),
      tx
        .select({ id: chats.id, name: chats.name, mode: chats.mode })
        .from(chats)
        .where(eq(chats.connectionId, connectionId)),
    ]);
    const references = { agents: agentRows, chats: chatRows };

    if (hasConnectionReferences(references)) {
      return { deleted: false, references };
    }

    await tx.delete(apiConnections).where(eq(apiConnections.id, connectionId));
    return { deleted: true, references };
  });
}

export async function deleteConnectionAndClearReferences(db: DB, connectionId: string): Promise<ConnectionReferences> {
  const references = await listConnectionReferences(db, connectionId);
  const timestamp = now();

  await db.transaction(async (tx) => {
    await tx
      .update(agentConfigs)
      .set({ connectionId: null, updatedAt: timestamp })
      .where(eq(agentConfigs.connectionId, connectionId));
    await tx.update(chats).set({ connectionId: null, updatedAt: timestamp }).where(eq(chats.connectionId, connectionId));
    await tx.delete(apiConnections).where(eq(apiConnections.id, connectionId));
  });

  return references;
}

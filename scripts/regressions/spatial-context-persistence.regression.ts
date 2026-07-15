import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SpatialContextDefinition, UpdateSpatialContextRequestInput } from "../../packages/shared/src/index.js";
import { createChatSchema } from "../../packages/shared/src/index.js";
import type { DB } from "../../packages/server/src/db/connection.js";
import { createFileNativeDB } from "../../packages/server/src/db/file-backed-store.js";
import { chats, spatialContextSnapshots } from "../../packages/server/src/db/schema/index.js";
import {
  createSpatialContextService,
  SpatialContextServiceError,
} from "../../packages/server/src/services/spatial-context/definition.service.js";
import { createChatsStorage } from "../../packages/server/src/services/storage/chats.storage.js";
import { createSpatialContextStorage } from "../../packages/server/src/services/storage/spatial-context.storage.js";

const storageDir = mkdtempSync(join(tmpdir(), "marinara-spatial-persistence-"));
process.env.FILE_STORAGE_DIR = storageDir;

const definition: SpatialContextDefinition = {
  schemaVersion: 1,
  ownerMode: "roleplay",
  enabled: true,
  revision: 0,
  startingLocationId: "tower",
  locations: [
    {
      id: "city",
      parentId: null,
      name: "City",
      kind: "settlement",
      description: "A crowded walled city.",
      childPresentation: "map",
      links: [],
      status: "active",
      sortOrder: 0,
    },
    {
      id: "tower",
      parentId: "city",
      name: "Tower",
      kind: "building",
      description: "An old stone tower.",
      modelMemory: "The tower belongs to the royal astronomer.",
      childPresentation: "list",
      placement: { x: 60, y: 25 },
      links: [],
      status: "active",
      sortOrder: 0,
    },
  ],
};

let fileDb = await createFileNativeDB();
let db = fileDb as unknown as DB;

try {
  const chatsStorage = createChatsStorage(db);
  const chat = await chatsStorage.create(
    createChatSchema.parse({
      name: "Spatial regression",
      mode: "roleplay",
      characterIds: [],
    }),
  );
  assert.ok(chat);

  const service = createSpatialContextService(db);
  const created = await service.update(chat.id, {
    expectedRevision: 0,
    expectedCurrentLocationId: null,
    definition,
  });
  assert.equal(created.definition?.revision, 1);
  assert.equal(created.currentLocationId, "tower");
  assert.deepEqual(
    created.breadcrumb.map((item) => item.id),
    ["city", "tower"],
  );

  await fileDb._fileStore.close();
  fileDb = await createFileNativeDB();
  db = fileDb as unknown as DB;

  const reopenedService = createSpatialContextService(db);
  const reopened = await reopenedService.get(chat.id);
  assert.equal(reopened.definition?.revision, 1);
  assert.equal(reopened.currentLocationId, "tower");
  assert.equal(reopened.destinations[0]?.id, "city");

  const rowsBefore = {
    chats: await db.select().from(chats),
    snapshots: await db.select().from(spatialContextSnapshots),
  };
  assert.equal(rowsBefore.snapshots.length, 1);
  assert.equal(rowsBefore.snapshots[0]?.source, "bootstrap");

  await assert.rejects(
    reopenedService.update(chat.id, {
      expectedRevision: 0,
      expectedCurrentLocationId: "tower",
      definition,
    }),
    (error: unknown) => error instanceof SpatialContextServiceError && error.code === "spatial_definition_stale",
  );

  const malformed = {
    expectedRevision: 1,
    expectedCurrentLocationId: "tower",
    definition: {
      ...definition,
      revision: 1,
      locations: [{ ...definition.locations[0], name: "" }],
    },
  } as UpdateSpatialContextRequestInput;
  await assert.rejects(
    reopenedService.update(chat.id, malformed),
    (error: unknown) => error instanceof SpatialContextServiceError && error.code === "spatial_replacement_invalid",
  );

  assert.deepEqual(await db.select().from(chats), rowsBefore.chats);
  assert.deepEqual(await db.select().from(spatialContextSnapshots), rowsBefore.snapshots);

  const updated = await reopenedService.update(chat.id, {
    expectedRevision: 1,
    expectedCurrentLocationId: "tower",
    replacementCurrentLocationId: "city",
    definition: {
      ...definition,
      revision: 1,
      locations: definition.locations.map((location) =>
        location.id === "tower" ? { ...location, description: "A restored observatory tower." } : location,
      ),
    },
  });
  assert.equal(updated.definition?.revision, 2);
  assert.equal(updated.currentLocationId, "tower");
  assert.equal((await db.select().from(spatialContextSnapshots)).length, 1);

  const historyAnchor = await createChatsStorage(db).createMessage({
    chatId: chat.id,
    role: "assistant",
    content: "The campaign begins in the tower.",
    characterId: null,
  });
  await createSpatialContextStorage(db).create({
    chatId: chat.id,
    messageId: historyAnchor.id,
    swipeIndex: 0,
    currentLocationId: "tower",
    definitionRevision: 2,
    source: "assistant_swipe",
  });
  assert.equal((await reopenedService.get(chat.id)).hasCommittedSpatialHistory, true);

  await assert.rejects(
    reopenedService.update(chat.id, {
      expectedRevision: 2,
      expectedCurrentLocationId: "tower",
      definition: {
        ...definition,
        revision: 2,
        locations: [{ ...definition.locations[1]!, parentId: null }],
      },
    }),
    (error: unknown) =>
      error instanceof SpatialContextServiceError && error.code === "spatial_history_location_removal_forbidden",
  );

  const expanded = await reopenedService.update(chat.id, {
    expectedRevision: 2,
    expectedCurrentLocationId: "tower",
    definition: {
      ...definition,
      revision: 2,
      locations: [
        ...definition.locations,
        {
          id: "observatory",
          parentId: "tower",
          name: "Observatory",
          kind: "room",
          description: "A brass-domed observatory.",
          childPresentation: "list",
          links: [],
          status: "active",
          sortOrder: 0,
        },
      ],
    },
  });
  assert.equal(expanded.definition?.revision, 3);
  assert.equal(expanded.hasCommittedSpatialHistory, true);
} finally {
  await fileDb._fileStore.close();
  rmSync(storageDir, { recursive: true, force: true });
}

process.stdout.write("Spatial persistence regression passed.\n");

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDocument, database, deleteDocument, duplicateDocument, listDocuments, saveDocument } from "./database";

describe("IndexedDB document storage", () => {
  beforeEach(async () => {
    await database.documents.clear();
  });

  afterEach(async () => {
    await database.documents.clear();
  });

  it("persists, orders, duplicates, and deletes documents", async () => {
    const first = await createDocument("First", "markdown", "# one");
    const second = await createDocument("Second", "text", "two");
    await saveDocument({ ...first, content: "# saved" });

    const listed = await listDocuments();
    expect(listed.map((item) => item.title)).toEqual(["Second", "First"]);
    expect(listed[1]?.content).toBe("# saved");

    const copy = await duplicateDocument(listed[1]!);
    expect(copy.title).toBe("First copy");
    expect(copy.content).toBe("# saved");
    await deleteDocument(second.id);
    expect((await listDocuments()).map((item) => item.id)).not.toContain(second.id);
  });

  it("limits document titles to the supported share title length", async () => {
    const document = await createDocument("x".repeat(200));
    expect(document.title).toHaveLength(160);
  });

  it("keeps documents with duplicate titles separate", async () => {
    const first = await createDocument("Meeting notes", "text", "First");
    const second = await createDocument("Meeting notes", "text", "Second");

    expect(second.id).not.toBe(first.id);
    expect((await listDocuments()).filter((item) => item.title === "Meeting notes")).toHaveLength(2);
  });
});

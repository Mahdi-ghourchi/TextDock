import Dexie, { type EntityTable } from "dexie";
import type { TextDocument } from "./types";

export class TextDockDatabase extends Dexie {
  documents!: EntityTable<TextDocument, "id">;

  constructor() {
    super("textdock");
    this.version(1).stores({
      documents: "id, title, updatedAt, format",
    });
  }
}

export const database = new TextDockDatabase();

export async function listDocuments(): Promise<TextDocument[]> {
  return database.documents.orderBy("updatedAt").reverse().toArray();
}

export async function saveDocument(document: TextDocument): Promise<void> {
  await database.documents.put(document);
}

export async function createDocument(
  title = "Untitled document",
  format: TextDocument["format"] = "markdown",
  content = "",
): Promise<TextDocument> {
  const now = Date.now();
  const safeTitle = title.slice(0, 160) || "Untitled document";
  const document: TextDocument = {
    id: crypto.randomUUID(),
    title: safeTitle,
    content,
    format,
    createdAt: now,
    updatedAt: now,
  };
  await database.documents.add(document);
  return document;
}

export async function deleteDocument(id: string): Promise<void> {
  await database.documents.delete(id);
}

export async function duplicateDocument(document: TextDocument): Promise<TextDocument> {
  const copy = await createDocument(`${document.title} copy`, document.format, document.content);
  return copy;
}

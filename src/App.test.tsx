import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { TextDocument } from "./lib/types";

const databaseMocks = vi.hoisted(() => ({
  listDocuments: vi.fn(),
  createDocument: vi.fn(),
  saveDocument: vi.fn(),
  deleteDocument: vi.fn(),
  duplicateDocument: vi.fn(),
}));
const sharingMocks = vi.hoisted(() => ({
  createShare: vi.fn(),
  revokeShare: vi.fn(),
  fetchSnapshot: vi.fn(),
}));

vi.mock("./lib/database", () => databaseMocks);
vi.mock("./lib/sharing", () => sharingMocks);

function makeDocument(): TextDocument {
  return {
    id: "doc-1",
    title: "Field notes",
    content: "# Field notes",
    format: "markdown",
    createdAt: 1,
    updatedAt: Date.now(),
  };
}

describe("TextDock editor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
    databaseMocks.listDocuments.mockResolvedValue([makeDocument()]);
    sharingMocks.createShare.mockResolvedValue({
      id: "share-1",
      access_token: "access-secret",
      revoke_capability: "revoke-secret",
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      url: "http://localhost:5173/s/share-1#access=access-secret",
    });
    sharingMocks.revokeShare.mockResolvedValue(undefined);
    databaseMocks.saveDocument.mockResolvedValue(undefined);
    databaseMocks.createDocument.mockImplementation(async (title = "Untitled document", format = "markdown", content = "") => ({
      ...makeDocument(),
      id: `created-${Date.now()}`,
      title,
      format,
      content,
    }));
  });

  it("opens local documents, edits content, and autosaves after typing settles", async () => {
    const user = userEvent.setup();
    render(<App />);
    const editor = await screen.findByLabelText("Document content");
    await user.clear(editor);
    await user.type(editor, "Saved locally");

    await waitFor(() => expect(databaseMocks.saveDocument).toHaveBeenCalledWith(expect.objectContaining({
      id: "doc-1",
      content: "Saved locally",
    })), { timeout: 2000 });
  });

  it("keeps editing available when browser preference storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage is unavailable");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage is unavailable");
    });

    render(<App />);

    expect(await screen.findByLabelText("Document content")).toBeInTheDocument();
  });

  it("switches to a safe Markdown preview and toggles the appearance", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByLabelText("Document content");
    await user.click(screen.getAllByRole("button", { name: "Preview" })[0]!);
    expect(await screen.findByRole("heading", { name: "Field notes" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Switch to dark appearance" }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
  });

  it("lets a new document switch between Markdown and plain text", async () => {
    const user = userEvent.setup();
    databaseMocks.listDocuments.mockResolvedValue([]);
    render(<App />);
    await user.click(await screen.findByRole("button", { name: /create a document/i }));
    const format = await screen.findByLabelText("Document format");
    await user.selectOptions(format, "text");
    expect(format).toHaveValue("text");
    await user.click(screen.getAllByRole("button", { name: "Preview" })[0]!);
    expect(screen.getByText("This document is empty.")).toBeInTheDocument();
  });

  it("creates an explicit read-only snapshot and revokes it with a separate capability", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByLabelText("Document content");
    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(screen.getByRole("button", { name: /create read-only link/i }));
    expect(await screen.findByLabelText(/private link/i)).toHaveValue(
      "http://localhost:5173/s/share-1#access=access-secret",
    );
    await user.click(screen.getByRole("button", { name: /revoke link/i }));
    await waitFor(() => expect(sharingMocks.revokeShare).toHaveBeenCalledWith("share-1", "revoke-secret"));
  });

  it("shows share revocation failures while the share is open", async () => {
    const user = userEvent.setup();
    sharingMocks.revokeShare.mockRejectedValue(new Error("The sharing service is unavailable."));
    render(<App />);
    await screen.findByLabelText("Document content");
    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(screen.getByRole("button", { name: /create read-only link/i }));
    await screen.findByLabelText(/private link/i);
    await user.click(screen.getByRole("button", { name: /revoke link/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The sharing service is unavailable.");
  });

  it("saves pending edits before switching documents", async () => {
    const user = userEvent.setup();
    const nextDocument = { ...makeDocument(), id: "doc-2", title: "Second note", content: "Second" };
    databaseMocks.listDocuments.mockResolvedValue([makeDocument(), nextDocument]);
    render(<App />);
    const editor = await screen.findByLabelText("Document content");
    await user.clear(editor);
    await user.type(editor, "Latest draft");
    await user.click(screen.getByRole("button", { name: /second note/i }));

    await waitFor(() => expect(databaseMocks.saveDocument).toHaveBeenCalledWith(expect.objectContaining({
      id: "doc-1",
      content: "Latest draft",
    })));
    expect(screen.getByLabelText("Document content")).toHaveValue("Second");
  });

  it("does not switch documents when the pending local save fails", async () => {
    const user = userEvent.setup();
    const nextDocument = { ...makeDocument(), id: "doc-2", title: "Second note", content: "Second" };
    databaseMocks.listDocuments.mockResolvedValue([makeDocument(), nextDocument]);
    databaseMocks.saveDocument.mockRejectedValue(new Error("Storage quota exceeded"));
    render(<App />);
    const editor = await screen.findByLabelText("Document content");
    await user.clear(editor);
    await user.type(editor, "Unsaved draft");
    await user.click(screen.getByRole("button", { name: /second note/i }));

    expect(await screen.findByText("Could not save your current document, so it was not switched.")).toBeInTheDocument();
    expect(screen.getByLabelText("Document content")).toHaveValue("Unsaved draft");
  });

  it("can delete the last document and return to the empty state", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<App />);
    await screen.findByLabelText("Document content");
    await user.click(screen.getByRole("button", { name: "More document actions" }));
    await user.click(screen.getByRole("button", { name: "Delete document" }));
    expect(await screen.findByRole("heading", { name: "No document selected" })).toBeInTheDocument();
    expect(databaseMocks.deleteDocument).toHaveBeenCalledWith("doc-1");
  });

  it("imports supported text files into the local document library", async () => {
    const user = userEvent.setup();
    databaseMocks.listDocuments.mockResolvedValue([]);
    render(<App />);
    await screen.findByRole("heading", { name: "No document selected" });
    const file = new File(["plain notes"], "trip.txt", { type: "text/plain" });
    Object.defineProperty(file, "text", { value: async () => "plain notes" });
    await user.upload(screen.getByLabelText("Import a Markdown or text file"), file);

    await waitFor(() => expect(databaseMocks.createDocument).toHaveBeenCalledWith("trip", "text", "plain notes"));
    expect(await screen.findByLabelText("Document content")).toHaveValue("plain notes");
  });
});

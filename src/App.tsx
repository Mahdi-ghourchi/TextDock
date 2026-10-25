import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignLeft,
  ArrowDownToLine,
  BookOpen,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  Copy,
  FilePlus2,
  FileText,
  FolderOpen,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Share2,
  Sun,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { MarkdownPreview } from "./components/MarkdownPreview";
import {
  createDocument,
  deleteDocument,
  duplicateDocument,
  listDocuments,
  saveDocument,
} from "./lib/database";
import { downloadDocument, getDocumentFormat, titleFromFilename } from "./lib/format";
import { createShare, fetchSnapshot, revokeShare, type CreatedShare, type PublicSnapshot } from "./lib/sharing";
import type { DocumentFormat, SaveState, TextDocument } from "./lib/types";

type ViewMode = "write" | "preview";

function isShareRoute(): boolean {
  return /^\/s\/[^/]+\/?$/.test(window.location.pathname);
}

function getShareId(): string {
  const id = window.location.pathname.split("/").filter(Boolean)[1] ?? "";
  return /^[A-Za-z0-9_-]{16,48}$/.test(id) ? id : "";
}

function useInitialTheme(): "light" | "dark" {
  try {
    return window.localStorage.getItem("textdock-theme") === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">(useInitialTheme);
  const [documents, setDocuments] = useState<TextDocument[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("write");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [statusMessage, setStatusMessage] = useState("");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [share, setShare] = useState<CreatedShare | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState("");
  const [shareNotice, setShareNotice] = useState("");
  const [shareHours, setShareHours] = useState(168);
  const importRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<TextDocument | null>(null);
  const saveTimerRef = useRef<number | undefined>(undefined);
  const savingRef = useRef<Promise<void> | null>(null);
  const saveVersionRef = useRef(0);

  const activeDocument = documents.find((document) => document.id === activeId) ?? null;
  activeRef.current = activeDocument;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem("textdock-theme", theme);
    } catch {
      // Theme preference is optional; storage restrictions must not block editing.
    }
  }, [theme]);

  useEffect(() => {
    let mounted = true;
    async function loadLibrary() {
      try {
        const items = await listDocuments();
        if (mounted) {
          setDocuments(items);
          setActiveId(items[0]?.id ?? null);
          setReady(true);
        }
      } catch {
        if (mounted) {
          setLoadError("Your local document library could not be opened. Check this browser's storage settings and reload.");
          setReady(true);
        }
      }
    }
    void loadLibrary();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!activeDocument || !ready) return;
    const version = ++saveVersionRef.current;
    const snapshot = activeDocument;
    setSaveState("saving");
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      const isCurrent = () =>
        saveVersionRef.current === version &&
        activeRef.current?.id === snapshot.id &&
        activeRef.current.content === snapshot.content &&
        activeRef.current.title === snapshot.title;
      const pending = saveDocument(snapshot)
        .then(() => {
          if (isCurrent()) {
            setSaveState("saved");
            setStatusMessage("All changes saved on this device.");
          }
        })
        .catch(() => {
          if (isCurrent()) {
            setSaveState("error");
            setStatusMessage("Could not save this document. Check available browser storage and try again.");
          }
        })
        .finally(() => {
          if (savingRef.current === pending) savingRef.current = null;
        });
      savingRef.current = pending;
    }, 550);
    return () => window.clearTimeout(saveTimerRef.current);
  }, [activeDocument?.id, activeDocument?.title, activeDocument?.content, activeDocument?.format, ready]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveNow();
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setViewMode((mode) => mode === "write" ? "preview" : "write");
      }
      if (event.key === "Escape") {
        setShareOpen(false);
        setStatusMessage("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return documents;
    return documents.filter((item) =>
      item.title.toLocaleLowerCase().includes(query) ||
      item.content.toLocaleLowerCase().includes(query),
    );
  }, [documents, search]);

  const replaceActive = useCallback((changes: Partial<TextDocument>) => {
    if (!activeId) return;
    setDocuments((items) =>
      items.map((item) => item.id === activeId ? { ...item, ...changes, updatedAt: Date.now() } : item)
        .sort((left, right) => right.updatedAt - left.updatedAt),
    );
  }, [activeId]);

  async function saveNow() {
    if (!activeRef.current) return;
    window.clearTimeout(saveTimerRef.current);
    const version = ++saveVersionRef.current;
    setSaveState("saving");
    try {
      if (savingRef.current) await savingRef.current;
      const current = activeRef.current;
      if (!current) return;
      const pending = saveDocument(current);
      savingRef.current = pending;
      await pending;
      if (saveVersionRef.current === version && activeRef.current?.id === current.id) {
        setSaveState("saved");
        setStatusMessage("Saved on this device.");
      }
    } catch {
      if (saveVersionRef.current === version) {
        setSaveState("error");
        setStatusMessage("Could not save this document. Check available browser storage and try again.");
      }
    } finally {
      savingRef.current = null;
    }
  }

  async function waitForPendingSave() {
    window.clearTimeout(saveTimerRef.current);
    if (savingRef.current) await savingRef.current;
    const current = activeRef.current;
    if (current) {
      const version = ++saveVersionRef.current;
      setSaveState("saving");
      await saveDocument(current);
      if (saveVersionRef.current === version && activeRef.current?.id === current.id) {
        setSaveState("saved");
        setStatusMessage("All changes saved on this device.");
      }
    }
  }

  async function makeDocument() {
    try {
      await waitForPendingSave();
      const created = await createDocument();
      setDocuments((items) => [created, ...items]);
      setActiveId(created.id);
      setViewMode("write");
      setSearch("");
      setStatusMessage("New document created.");
    } catch {
      setStatusMessage("Could not create a document. Check browser storage and try again.");
    }
  }

  async function selectDocument(id: string) {
    try {
      await waitForPendingSave();
      setActiveId(id);
      setViewMode("write");
      setStatusMessage("");
    } catch {
      setStatusMessage("Could not save your current document, so it was not switched.");
    }
  }

  async function duplicateActive() {
    if (!activeDocument) return;
    try {
      await waitForPendingSave();
      const copy = await duplicateDocument(activeDocument);
      setDocuments((items) => [copy, ...items.filter((item) => item.id !== copy.id)]);
      setActiveId(copy.id);
      setStatusMessage("A copy is ready to edit.");
    } catch {
      setStatusMessage("Could not duplicate this document. Check browser storage and try again.");
    }
  }

  async function removeActive() {
    if (!activeDocument) return;
    const confirmed = window.confirm(`Delete “${activeDocument.title || "Untitled document"}” from this device? This cannot be undone.`);
    if (!confirmed) return;
    try {
      await waitForPendingSave();
      await deleteDocument(activeDocument.id);
      const remaining = documents.filter((item) => item.id !== activeDocument.id);
      setDocuments(remaining);
      setActiveId(remaining[0]?.id ?? null);
      setStatusMessage("Document deleted from this device.");
    } catch {
      setStatusMessage("Could not delete this document. Check browser storage and try again.");
    }
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    if (!/\.(md|markdown|txt)$/i.test(file.name)) {
      setStatusMessage("Choose a Markdown (.md, .markdown) or text (.txt) file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setStatusMessage("That file is larger than 5 MB. Choose a smaller file.");
      return;
    }
    try {
      await waitForPendingSave();
      const content = await file.text();
      const imported = await createDocument(
        titleFromFilename(file.name),
        getDocumentFormat(file.name),
        content,
      );
      setDocuments((items) => [imported, ...items]);
      setActiveId(imported.id);
      setViewMode("write");
      setStatusMessage(`Imported ${file.name}.`);
    } catch {
      setStatusMessage("Could not import the file. Check browser storage and try again.");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }

  async function publishSnapshot() {
    if (!activeDocument) return;
    setShareBusy(true);
    setShareError("");
    setShareNotice("");
    try {
      const result = await createShare(activeDocument.title, activeDocument.content, activeDocument.format, shareHours);
      setShare(result);
      setShareNotice("");
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "The sharing service could not create a link.");
    } finally {
      setShareBusy(false);
    }
  }

  async function revokeCurrentShare() {
    if (!share) return;
    setShareBusy(true);
    setShareError("");
    setShareNotice("");
    try {
      await revokeShare(share.id, share.revoke_capability);
      setShare(null);
      setShareNotice("This share link has been revoked.");
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "The share could not be revoked.");
    } finally {
      setShareBusy(false);
    }
  }

  async function copyShareLink() {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.url);
      setShareError("");
      setShareNotice("Share link copied to clipboard.");
    } catch {
      setShareNotice("");
      setShareError("Clipboard access is unavailable. Select and copy the link instead.");
    }
  }

  if (isShareRoute()) {
    return <SharedDocument theme={theme} setTheme={setTheme} />;
  }

  return (
    <main className="app-shell">
      <aside className={`library ${sidebarOpen ? "" : "library--collapsed"}`} aria-label="Document library">
        <div className="brand-row">
          <span className="brand-mark" aria-hidden="true"><AlignLeft size={18} strokeWidth={2.4} /></span>
          {sidebarOpen && <span className="brand-name">textdock<span className="brand-period">.</span></span>}
          <button className="icon-button sidebar-toggle" type="button" aria-label={sidebarOpen ? "Collapse library" : "Expand library"} onClick={() => setSidebarOpen((open) => !open)}>
            {sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
          </button>
        </div>

        {sidebarOpen && <>
          <div className="library-heading">
            <span>YOUR LIBRARY</span>
            <button className="icon-button" type="button" aria-label="Create document" onClick={() => void makeDocument()}><Plus size={17} /></button>
          </div>
          <label className="search-field">
            <Search size={15} aria-hidden="true" />
            <span className="sr-only">Search documents</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search documents" />
            {search && <button className="clear-search" type="button" aria-label="Clear search" onClick={() => setSearch("")}><X size={13} /></button>}
          </label>
          <nav className="document-list" aria-label="Your documents">
            {filteredDocuments.map((item) => (
              <button
                className={`document-row ${item.id === activeId ? "document-row--active" : ""}`}
                key={item.id}
                type="button"
                onClick={() => void selectDocument(item.id)}
                aria-current={item.id === activeId ? "page" : undefined}
              >
                <FileText size={16} aria-hidden="true" />
                <span className="document-row-copy">
                  <span className="document-row-title">{item.title || "Untitled document"}</span>
                  <span className="document-row-meta">{item.format === "markdown" ? "Markdown" : "Plain text"} · {relativeTime(item.updatedAt)}</span>
                </span>
              </button>
            ))}
            {filteredDocuments.length === 0 && <p className="empty-search">{documents.length ? "No matching documents." : "Your library is empty."}</p>}
          </nav>
          <button className="import-button" type="button" onClick={() => importRef.current?.click()}><Upload size={15} /> Import a file</button>
          <div className="library-footer">
            <div className="local-note"><span className="local-dot" /><span>Stored on this device</span></div>
            <button className="theme-button" type="button" onClick={() => setTheme((current) => current === "light" ? "dark" : "light")}>
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
              <span>{theme === "light" ? "Dark appearance" : "Light appearance"}</span>
            </button>
          </div>
        </>}
        <input ref={importRef} className="sr-only" type="file" accept=".md,.markdown,.txt,text/plain,text/markdown" onChange={(event) => void importFile(event.target.files?.[0])} aria-label="Import a Markdown or text file" />
      </aside>

      <section className="workspace" aria-label="Text editor">
        <h1 className="sr-only">TextDock editor</h1>
        <header className="topbar">
          <div className="breadcrumb">
            <FolderOpen size={16} aria-hidden="true" />
            <span>My documents</span>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">{activeDocument?.title || "No document selected"}</span>
          </div>
          <div className="topbar-actions">
            <div className={`save-status save-status--${saveState}`} role="status" aria-live="polite">
              {saveState === "saved" ? <Check size={14} /> : saveState === "saving" ? <Clock3 size={14} /> : <CircleAlert size={14} />}
              <span>{saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : "Save failed"}</span>
            </div>
            <button className="icon-button topbar-theme" type="button" aria-label={theme === "light" ? "Switch to dark appearance" : "Switch to light appearance"} onClick={() => setTheme((current) => current === "light" ? "dark" : "light")}>
              {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <button className="share-button" type="button" disabled={!activeDocument} onClick={() => { setShare(null); setShareError(""); setShareNotice(""); setShareOpen(true); }}>
              <Share2 size={15} /> <span>Share</span>
            </button>
          </div>
        </header>

        <div className="editor-area">
          {!ready ? (
            <div className="loading-state"><span className="loading-dot" /> Opening your library…</div>
          ) : loadError ? (
            <div className="error-panel" role="alert"><CircleAlert size={20} /><div><strong>Library unavailable</strong><p>{loadError}</p></div></div>
          ) : activeDocument ? (
            <div className="document-editor">
              <div className="document-toolbar">
                <div className="format-label"><span className="format-square">{activeDocument.format === "markdown" ? "M" : "T"}</span><label className="sr-only" htmlFor="document-format">Document format</label><select id="document-format" className="format-select" value={activeDocument.format} onChange={(event) => { const value = event.target.value; if (value === "markdown" || value === "text") replaceActive({ format: value satisfies DocumentFormat }); }}><option value="markdown">Markdown</option><option value="text">Plain text</option></select><ChevronDown size={13} aria-hidden="true" /></div>
                <div className="toolbar-actions">
                  <div className="view-switch" role="group" aria-label="Editor view">
                    <button type="button" className={viewMode === "write" ? "view-switch-active" : ""} aria-pressed={viewMode === "write"} onClick={() => setViewMode("write")}><AlignLeft size={14} /> Write</button>
                    <button type="button" className={viewMode === "preview" ? "view-switch-active" : ""} aria-pressed={viewMode === "preview"} onClick={() => setViewMode("preview")}><BookOpen size={14} /> Preview</button>
                  </div>
                  <button className="icon-button toolbar-icon" type="button" aria-label="Save now" title="Save now (Ctrl+S)" onClick={() => void saveNow()}><Check size={16} /></button>
                  <div className="menu-wrap">
                    <button className="icon-button toolbar-icon" type="button" aria-label="More document actions" aria-expanded={actionsOpen} aria-controls="document-actions-menu" onClick={() => setActionsOpen((open) => !open)}><MoreHorizontal size={18} /></button>
                    {actionsOpen && <div className="menu-popover" id="document-actions-menu" role="group" aria-label="Document actions">
                        <button type="button" onClick={() => { if (activeDocument) downloadDocument(activeDocument.title || "Untitled document", activeDocument.content, activeDocument.format); setActionsOpen(false); }}><ArrowDownToLine size={15} /> Export file</button>
                        <button type="button" onClick={() => { setActionsOpen(false); void duplicateActive(); }}><Copy size={15} /> Make a copy</button>
                        <button className="menu-danger" type="button" onClick={() => { setActionsOpen(false); void removeActive(); }}><Trash2 size={15} /> Delete document</button>
                      </div>}
                  </div>
                </div>
              </div>

              <div className="document-heading">
                <label className="sr-only" htmlFor="document-title">Document title</label>
                <input id="document-title" className="title-input" value={activeDocument.title} onChange={(event) => replaceActive({ title: event.target.value.slice(0, 160) })} placeholder="Untitled document" maxLength={160} />
                <span className="document-date">Edited {relativeTime(activeDocument.updatedAt)}</span>
              </div>

              {viewMode === "write" ? (
                <div className="writing-surface">
                  <label className="sr-only" htmlFor="document-content">Document content</label>
                  <textarea
                    id="document-content"
                    className="editor-textarea"
                    value={activeDocument.content}
                    onChange={(event) => replaceActive({ content: event.target.value })}
                    placeholder={activeDocument.format === "markdown" ? "Start writing in Markdown…" : "Start writing…"}
                    spellCheck
                  />
                  <div className="editor-footnote"><span>{activeDocument.content.length.toLocaleString()} characters</span><span>⌘/Ctrl + S to save</span></div>
                </div>
              ) : activeDocument.format === "markdown" ? (
                <div className="preview-surface"><MarkdownPreview content={activeDocument.content} /></div>
              ) : (
                <pre className="preview-surface plain-preview">{activeDocument.content || "This document is empty."}</pre>
              )}
              {statusMessage && <div className="inline-status" role="status">{statusMessage}<button type="button" aria-label="Dismiss message" onClick={() => setStatusMessage("")}><X size={13} /></button></div>}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon"><FilePlus2 size={23} /></div>
              <h1>No document selected</h1>
              <p>Start a new note or bring in a file from your device.</p>
              <button className="primary-button" type="button" onClick={() => void makeDocument()}><Plus size={16} /> Create a document</button>
              <button className="text-button" type="button" onClick={() => importRef.current?.click()}><Upload size={15} /> Import a file</button>
            </div>
          )}
        </div>

        <footer className="statusbar">
          <div className="statusbar-left"><span className="local-dot" /><span>Local-first</span><span className="status-divider" /><span>{documents.length} {documents.length === 1 ? "document" : "documents"}</span></div>
          <div className="statusbar-right"><span>{activeDocument?.format === "markdown" ? "Markdown" : activeDocument ? "Plain text" : "Ready"}</span><span className="status-divider" /><span>UTF-8</span></div>
        </footer>
      </section>

      <ShareDialog
        open={shareOpen}
        document={activeDocument}
        hours={shareHours}
        setHours={setShareHours}
        share={share}
        busy={shareBusy}
        error={shareError}
        notice={shareNotice}
        onClose={() => setShareOpen(false)}
        onPublish={() => void publishSnapshot()}
        onCopy={() => void copyShareLink()}
        onRevoke={() => void revokeCurrentShare()}
      />
    </main>
  );
}

interface ShareDialogProps {
  open: boolean;
  document: TextDocument | null;
  hours: number;
  setHours: (hours: number) => void;
  share: CreatedShare | null;
  busy: boolean;
  error: string;
  notice: string;
  onClose: () => void;
  onPublish: () => void;
  onCopy: () => void;
  onRevoke: () => void;
}

function ShareDialog({ open, document: current, hours, setHours, share, busy, error, notice, onClose, onPublish, onCopy, onRevoke }: ShareDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]',
    ) ?? []);
    focusable()[0]?.focus();
    function trapTab(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first || !last) {
        event.preventDefault();
        dialog?.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    dialog?.addEventListener("keydown", trapTab);
    return () => {
      dialog?.removeEventListener("keydown", trapTab);
      previousFocus?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-heading" tabIndex={-1}>
        <div className="dialog-heading">
          <div><h2 id="share-heading">{share ? "Snapshot is ready" : "Share a snapshot"}</h2><p>{share ? "This link shows a read-only copy." : "Your local document stays private. Only this snapshot is uploaded."}</p></div>
          <button className="icon-button" type="button" aria-label="Close share dialog" onClick={onClose}><X size={18} /></button>
        </div>
        {share ? (
          <>
            <div className="snapshot-note"><Check size={16} /><span>Snapshot of <strong>{current?.title || "Untitled document"}</strong> created.</span></div>
            <label className="share-link-label" htmlFor="share-link">Private link — anyone with this link can read the snapshot</label>
            <div className="share-link-row"><input id="share-link" readOnly value={share.url} onFocus={(event) => event.currentTarget.select()} /><button className="primary-button" type="button" onClick={onCopy}><Copy size={15} /> Copy</button></div>
            {error && <p className="dialog-error" role="alert">{error}</p>}
            {notice && <p className="dialog-notice" role="status">{notice}</p>}
            <p className="expires-note">Expires {new Date(share.expires_at).toLocaleString()}.</p>
            <div className="capability-warning"><CircleAlert size={16} /><span>Keep this link private. To revoke it, use the button below while this dialog is open. The revoke capability is not stored.</span></div>
            <div className="dialog-actions"><button className="danger-button" type="button" disabled={busy} onClick={onRevoke}><Trash2 size={15} /> Revoke link</button><button className="secondary-button" type="button" onClick={onClose}>Done</button></div>
          </>
        ) : (
          <>
            <div className="snapshot-preview"><FileText size={18} /><div><strong>{current?.title || "Untitled document"}</strong><span>{current?.format === "markdown" ? "Markdown" : "Plain text"} · {current?.content.length.toLocaleString() ?? 0} characters</span></div></div>
            {current && new TextEncoder().encode(current.content).byteLength > 1_000_000 && <p className="dialog-error" role="alert">This document exceeds the 1 MB UTF-8 share limit. It remains saved locally.</p>}
            <label className="field-label" htmlFor="share-expiry">Link expires after</label>
            <select id="share-expiry" className="expiry-select" value={hours} onChange={(event) => setHours(Number(event.target.value))}>
              <option value={24}>24 hours</option><option value={168}>7 days</option><option value={720}>30 days</option>
            </select>
            <p className="dialog-footnote">TextDock uploads a point-in-time copy. Changes you make later will not change this link.</p>
            {error && <p className={`dialog-error ${error.startsWith("This share") ? "dialog-success" : ""}`} role="alert">{error}</p>}
            {notice && <p className="dialog-notice" role="status">{notice}</p>}
            <div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="button" disabled={busy || !current || new TextEncoder().encode(current.content).byteLength > 1_000_000} onClick={onPublish}>{busy ? "Creating link…" : <><Share2 size={15} /> Create read-only link</>}</button></div>
          </>
        )}
      </section>
    </div>
  );
}

interface SharedDocumentProps {
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
}

function SharedDocument({ theme, setTheme }: SharedDocumentProps) {
  const [snapshot, setSnapshot] = useState<PublicSnapshot | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    const id = getShareId();
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("access") ?? "";
    window.history.replaceState(null, "", window.location.pathname);
    if (!id || !token) {
      setError("This link is missing its access key. Ask the person who shared it for a complete link.");
      return;
    }
    void fetchSnapshot(id, token)
      .then((result) => { if (!cancelled) setSnapshot(result); })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "This snapshot is unavailable or has expired.");
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="shared-shell">
      <header className="shared-header"><a className="brand-link" href="/"><span className="brand-mark"><AlignLeft size={17} /></span><span>textdock<span className="brand-period">.</span></span></a><div><span className="read-only-badge"><BookOpen size={14} /> Read-only snapshot</span><button className="icon-button" type="button" aria-label={theme === "light" ? "Switch to dark appearance" : "Switch to light appearance"} onClick={() => setTheme(theme === "light" ? "dark" : "light")}>{theme === "light" ? <Moon size={16} /> : <Sun size={16} />}</button></div></header>
      {snapshot ? <article className="shared-document"><span className="shared-kicker">SHARED DOCUMENT</span><h1>{snapshot.title}</h1><p className="shared-expiry">Available until {new Date(snapshot.expires_at).toLocaleString()}</p>{snapshot.format === "markdown" ? <MarkdownPreview content={snapshot.content} /> : <pre className="shared-plain">{snapshot.content || "This document is empty."}</pre>}</article> : error ? <div className="share-error-page" role="alert"><CircleAlert size={25} /><h1>Snapshot unavailable</h1><p>{error}</p></div> : <div className="loading-state"><span className="loading-dot" /> Opening snapshot…</div>}
      <footer className="shared-footer">A private, read-only snapshot from TextDock</footer>
    </main>
  );
}

function relativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

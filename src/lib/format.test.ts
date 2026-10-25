import { describe, expect, it, vi } from "vitest";
import { downloadDocument, getDocumentFormat, titleFromFilename } from "./format";

describe("document file helpers", () => {
  it("detects plain text without depending on filename case", () => {
    expect(getDocumentFormat("readme.TXT")).toBe("text");
    expect(getDocumentFormat("notes.markdown")).toBe("markdown");
  });

  it("removes only supported extensions from imported titles", () => {
    expect(titleFromFilename("project.notes.md")).toBe("project.notes");
    expect(titleFromFilename(".txt")).toBe("Untitled document");
  });

  it("exports text through a temporary download URL", async () => {
    const createObjectURL = vi.fn(() => "blob:textdock");
    const revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    downloadDocument("notes", "hello", "text");
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:textdock");

    vi.unstubAllGlobals();
    click.mockRestore();
  });
});

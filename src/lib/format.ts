import type { DocumentFormat } from "./types";

export function getDocumentFormat(filename: string): DocumentFormat {
  return /\.txt$/i.test(filename) ? "text" : "markdown";
}

export function titleFromFilename(filename: string): string {
  return filename.replace(/\.(markdown|md|txt)$/i, "").trim() || "Untitled document";
}

export function downloadDocument(title: string, content: string, format: DocumentFormat): void {
  const extension = format === "text" ? "txt" : "md";
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = `${title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")}.${extension}`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

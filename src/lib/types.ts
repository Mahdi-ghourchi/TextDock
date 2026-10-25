export type DocumentFormat = "markdown" | "text";

export interface TextDocument {
  id: string;
  title: string;
  content: string;
  format: DocumentFormat;
  createdAt: number;
  updatedAt: number;
}

export type SaveState = "saved" | "saving" | "error";

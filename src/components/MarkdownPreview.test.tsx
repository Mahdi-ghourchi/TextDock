import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownPreview } from "./MarkdownPreview";

describe("MarkdownPreview", () => {
  it("renders basic Markdown and GitHub-flavored tables", () => {
    render(<MarkdownPreview content={"# Heading\n\n| Name | Value |\n| --- | --- |\n| local | saved |"} />);
    expect(screen.getByRole("heading", { name: "Heading" })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("saved")).toBeInTheDocument();
  });

  it("does not interpret raw HTML or allow executable link schemes", () => {
    const { container } = render(<MarkdownPreview content={'<script>alert("x")</script>\n\n[unsafe](javascript:alert(1))'} />);
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector('[href^="javascript:"]')).toBeNull();
    expect(screen.getByText("unsafe")).toBeInTheDocument();
    expect(container.querySelector("a")).not.toHaveAttribute("href");
  });

  it("does not fetch remote Markdown images automatically", () => {
    const { container } = render(
      <MarkdownPreview content="![private note](https://tracker.example/pixel.png)" />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Image omitted: private note")).toBeInTheDocument();
  });
});

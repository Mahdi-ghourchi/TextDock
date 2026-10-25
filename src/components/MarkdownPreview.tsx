import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

interface MarkdownPreviewProps {
  content: string;
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  return (
    <article className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          img: ({ alt }) => (
            <span className="markdown-image-note">
              {alt ? `Image omitted: ${alt}` : "Image omitted."}
            </span>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isSafeHref } from "@/lib/blog/rules";

export function MarkdownBody({ markdown }: { markdown: string }) {
  return (
    <div className="text-base leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h2 className="mt-8 text-2xl font-semibold tracking-tight">{children}</h2>,
          h2: ({ children }) => <h2 className="mt-8 text-2xl font-semibold tracking-tight">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-6 text-xl font-semibold tracking-tight">{children}</h3>,
          p: ({ children }) => <p className="mt-4">{children}</p>,
          ul: ({ children }) => <ul className="mt-4 list-disc space-y-2 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="mt-4 list-decimal space-y-2 pl-5">{children}</ol>,
          blockquote: ({ children }) => <blockquote className="mt-4 border-l-2 border-border pl-4 text-muted">{children}</blockquote>,
          img: () => null,
          a: ({ href, children }) => {
            if (!href || !isSafeHref(href)) return <span>{children}</span>;
            const external = href.startsWith("http");
            return (
              <a href={href} className="underline underline-offset-4" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {children}
              </a>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

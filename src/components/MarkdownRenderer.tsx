/**
 * Markdown Renderer Component - Renders markdown content with syntax highlighting
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import 'highlight.js/styles/github-dark.css';
import '@/styles/markdown.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = ''
}) => {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeRaw]}
        components={{
          // Customize heading styles
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mb-3 mt-4 text-gray-900 dark:text-darkText-primary">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold mb-2 mt-3 text-gray-900 dark:text-darkText-primary">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mb-2 mt-2 text-gray-900 dark:text-darkText-primary">
              {children}
            </h3>
          ),
          // Customize paragraph spacing
          p: ({ children }) => (
            <p className="mb-2 leading-relaxed text-gray-900 dark:text-darkText-primary">
              {children}
            </p>
          ),
          // Customize lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-2 space-y-1 text-gray-900 dark:text-darkText-primary">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-2 space-y-1 text-gray-900 dark:text-darkText-primary">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="ml-2 text-gray-900 dark:text-darkText-primary">
              {children}
            </li>
          ),
          // Customize code blocks
          code: ({ inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            return !inline ? (
              <div className="relative my-2">
                {match && (
                  <div className="absolute top-0 right-0 px-2 py-1 text-xs font-mono text-gray-400 bg-gray-800 rounded-bl">
                    {match[1]}
                  </div>
                )}
                <pre className="bg-gray-900 dark:bg-gray-950 rounded-lg p-3 overflow-x-auto">
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              </div>
            ) : (
              <code
                className="bg-gray-200 dark:bg-gray-800 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded text-sm font-mono"
                {...props}
              >
                {children}
              </code>
            );
          },
          // Customize blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-500 pl-4 italic my-2 text-gray-700 dark:text-darkText-secondary">
              {children}
            </blockquote>
          ),
          // Customize links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {children}
            </a>
          ),
          // Customize tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full border border-gray-300 dark:border-gray-700">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-100 dark:bg-gray-800">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-left font-semibold text-gray-900 dark:text-darkText-primary">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-gray-900 dark:text-darkText-primary">
              {children}
            </td>
          ),
          // Customize horizontal rules
          hr: () => (
            <hr className="my-4 border-gray-300 dark:border-gray-700" />
          ),
          // Customize strong/bold
          strong: ({ children }) => (
            <strong className="font-bold text-gray-900 dark:text-darkText-primary">
              {children}
            </strong>
          ),
          // Customize emphasis/italic
          em: ({ children }) => (
            <em className="italic text-gray-900 dark:text-darkText-primary">
              {children}
            </em>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

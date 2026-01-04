import { marked, Renderer } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js/lib/core';
import DOMPurify from 'dompurify';

// Import only needed languages for syntax highlighting
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import css from 'highlight.js/lib/languages/css';
import bash from 'highlight.js/lib/languages/bash';

// Register languages
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('json', json);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('css', css);
hljs.registerLanguage('bash', bash);

// Custom renderer for Obsidian-specific syntax
class ObsidianRenderer extends Renderer {
  // Handle [[wikilinks]]
  link(href: string, title: string | null | undefined, text: string): string {
    // Check if it's a wikilink (marked by our pre-processor)
    const isWikilink = href.startsWith('[[') && href.endsWith(']]');

    if (isWikilink) {
      const linkText = href.slice(2, -2);
      return `<a href="#" class="wikilink" data-note="${this.escapeHtml(linkText)}">${this.escapeHtml(linkText)}</a>`;
    }

    // Regular markdown link
    const titleAttr = title ? ` title="${this.escapeHtml(title)}"` : '';
    return `<a href="${this.escapeHtml(href)}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
  }

  // Handle text with hashtags
  text(text: string): string {
    // Replace #tags with clickable links (but not in code)
    return text.replace(/#([a-zA-Z][a-zA-Z0-9_\-]*)/g, (_match, tag) => {
      return `<span class="hashtag" data-tag="${tag}">#${tag}</span>`;
    });
  }

  // Handle callouts (Obsidian-specific)
  blockquote(quote: string): string {
    // Check if it's an Obsidian callout: > [!type] title
    const calloutMatch = quote.match(/^\[!(\w+)\]\s*(.*?)$/m);

    if (calloutMatch) {
      const [_match, type, title] = calloutMatch;
      const content = quote.replace(/^\[!\w+\].*?\n/, '');
      const calloutClass = `callout callout-${type.toLowerCase()}`;

      return `
        <div class="${calloutClass}">
          <div class="callout-title">${this.escapeHtml(title)}</div>
          <div class="callout-content">${content}</div>
        </div>
      `;
    }

    // Regular blockquote
    return `<blockquote>${quote}</blockquote>`;
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}

// Configure marked with custom renderer and syntax highlighting
marked.use(
  markedHighlight({
    highlight(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(code, { language: lang }).value;
        } catch (err) {
          console.error('Highlight error:', err);
        }
      }
      return code;
    },
  })
);

marked.use({ renderer: new ObsidianRenderer() });

// Set marked options
marked.setOptions({
  gfm: true, // GitHub Flavored Markdown
  breaks: true, // Convert \n to <br>
  pedantic: false,
  mangle: false, // Don't mangle email addresses
});

/**
 * Parse markdown to HTML with Obsidian syntax support
 * @param markdown - Raw markdown text
 * @param options - Parsing options
 * @returns Sanitized HTML string
 */
export function parseMarkdown(
  markdown: string,
  options?: {
    sanitize?: boolean;
    allowedTags?: string[];
    allowedAttributes?: Record<string, string[]>;
  }
): string {
  const { sanitize = true, allowedTags, allowedAttributes } = options || {};

  // Pre-process for Obsidian wikilinks
  let processed = markdown;

  // Convert [[wikilinks]] to markdown links format for parsing
  processed = processed.replace(/\[\[([^\]]+)\]\]/g, (match, content) => {
    return `[${content}](${match})`;
  });

  // Convert embedded images: ![[image.png]] -> ![](image.png)
  processed = processed.replace(/!\[\[([^\]]+)\]\]/g, (match, filename) => {
    return `![](${filename})`;
  });

  // Parse markdown
  const html = marked.parse(processed) as string;

  // Sanitize if requested
  if (sanitize) {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: allowedTags || [
        'p',
        'br',
        'strong',
        'em',
        'u',
        's',
        'a',
        'ul',
        'ol',
        'li',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'blockquote',
        'code',
        'pre',
        'span',
        'div',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
        'img',
        'hr',
      ],
      ALLOWED_ATTR: (allowedAttributes as Record<string, string> | undefined) || [
        'href',
        'title',
        'target',
        'rel',
        'class',
        'data-note',
        'data-tag',
        'src',
        'alt',
      ],
      ALLOWED_URI_REGEXP:
        /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|file|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    });
  }

  return html;
}

/**
 * Extract plain text from markdown (for previews)
 * @param markdown - Raw markdown text
 * @returns Plain text string
 */
export function markdownToPlainText(markdown: string): string {
  // Remove wikilinks
  let text = markdown.replace(/\[\[([^\]]+)\]\]/g, '$1');

  // Remove images
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');

  // Remove inline code
  text = text.replace(/`([^`]+)`/g, '$1');

  // Remove code blocks
  text = text.replace(/```[\s\S]*?```/g, '');

  // Remove headers
  text = text.replace(/^#{1,6}\s+/gm, '');

  // Remove bold/italic
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');

  // Remove links
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Remove blockquotes
  text = text.replace(/^>\s+/gm, '');

  return text.trim();
}

/**
 * Check if text contains markdown syntax
 * @param text - Text to check
 * @returns True if markdown detected
 */
export function isMarkdown(text: string): boolean {
  const markdownPatterns = [
    /^#{1,6}\s/m, // Headers
    /\*\*.*?\*\*/, // Bold
    /\*.*?\*/, // Italic
    /\[.*?\]\(.*?\)/, // Links
    /\[\[.*?\]\]/, // Wikilinks
    /^[-*+]\s/m, // Lists
    /^>\s/m, // Blockquotes
    /```/, // Code blocks
  ];

  return markdownPatterns.some((pattern) => pattern.test(text));
}

/**
 * Setup event handlers for markdown interactive elements (wikilinks, hashtags)
 * Call this after rendering markdown content
 */
export function setupMarkdownInteractivity(container: HTMLElement): void {
  // Handle wikilink clicks
  const wikilinks = container.querySelectorAll('.wikilink');
  wikilinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const noteName = (link as HTMLElement).dataset.note;
      if (noteName) {
        // Dispatch custom event for app to handle
        window.dispatchEvent(
          new CustomEvent('navigate-wikilink', {
            detail: { noteName },
          })
        );
      }
    });
  });

  // Handle hashtag clicks
  const hashtags = container.querySelectorAll('.hashtag');
  hashtags.forEach((tag) => {
    tag.addEventListener('click', () => {
      const tagName = (tag as HTMLElement).dataset.tag;
      if (tagName) {
        // Dispatch custom event for app to handle
        window.dispatchEvent(
          new CustomEvent('filter-by-tag', {
            detail: { tag: tagName },
          })
        );
      }
    });
  });
}

export default {
  parseMarkdown,
  markdownToPlainText,
  isMarkdown,
  setupMarkdownInteractivity,
};

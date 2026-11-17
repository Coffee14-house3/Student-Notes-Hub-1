import React from "react";
import { Sparkles, ExternalLink } from "lucide-react";
import { FigureCard } from "./FigureCard";

export type ReaderFontSize = "small" | "medium" | "large" | "xlarge";

const FONT_SIZE_CLASSES: Record<ReaderFontSize, string> = {
  small: "text-sm leading-relaxed",
  medium: "text-[15px] sm:text-base leading-[1.7]",
  large: "text-[17px] sm:text-lg leading-[1.75]",
  xlarge: "text-[19px] sm:text-xl leading-[1.8]",
};

export const PaperMarkdownRenderer: React.FC<{
  content: string;
  isDark?: boolean;
  fontSize?: ReaderFontSize;
}> = ({ content, isDark = false, fontSize = "medium" }) => {
  const lines = (content || "").split("\n");
  const bodySizeClass = FONT_SIZE_CLASSES[fontSize] || FONT_SIZE_CLASSES.medium;

  return (
    <div className={`space-y-3 min-w-0 break-words ${bodySizeClass}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Suppress presenter notes and speaker notes completely
        if (
          trimmed.startsWith("> Speaker Notes:") || 
          trimmed.startsWith("> **Speaker Notes:**") ||
          trimmed.startsWith("> Presenter Notes:") ||
          trimmed.startsWith("> **Presenter Notes:**") ||
          trimmed === "Speaker Notes:" ||
          trimmed === "Presenter Notes:" ||
          trimmed === "**Speaker Notes:**" ||
          trimmed === "**Presenter Notes:**" ||
          /^>\s*\d+\s*$/.test(trimmed) ||
          /^\s*\d+\s*$/.test(trimmed)
        ) {
          return null;
        }

        // Suppress redundant duplicate slide titles like "## Slide 3: STEP 1 · VLAN"
        if (/^##\s*Slide\s*\d+[\s\:]/i.test(trimmed)) {
          return null;
        }

        // Takeaway / Quote Banner
        if (trimmed.startsWith("> ")) {
          const quoteText = trimmed.replace(/^>\s*/, "");
          return (
            <div key={idx} className={`p-3.5 sm:p-5 rounded-xl border ${isDark ? "bg-amber-950/35 border-amber-500/40 text-amber-100" : "bg-amber-50 border-amber-300 text-amber-950"} my-4 shadow-sm flex items-start gap-3`}>
              <div className={`p-1.5 sm:p-2 rounded-lg shrink-0 ${isDark ? "bg-amber-500/20 text-amber-300" : "bg-amber-100 text-amber-800"}`}>
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex-1 text-sm sm:text-[15px] font-medium leading-relaxed min-w-0 break-words">
                {renderBoldText(quoteText.replace(/^\*\*(?:Key Takeaway:?|Takeaway:?)\*\*\s*/i, ""), isDark)}
              </div>
            </div>
          );
        }

        if (trimmed.startsWith("## ")) {
          return (
            <h2 key={idx} className={`text-lg sm:text-xl font-bold mt-5 mb-2 border-b pb-1.5 break-words ${isDark ? "text-amber-400 border-slate-700" : "text-amber-800 border-slate-200"}`}>
              {renderBoldText(trimmed.replace(/^##\s*/, ""), isDark)}
            </h2>
          );
        }
        if (trimmed.startsWith("### ")) {
          return (
            <h3 key={idx} className={`text-base sm:text-lg font-bold mt-4 mb-2 break-words ${isDark ? "text-amber-300" : "text-amber-800"}`}>
              {renderBoldText(trimmed.replace("### ", ""), isDark)}
            </h3>
          );
        }
        if (trimmed.startsWith("#### ")) {
          return (
            <h4 key={idx} className={`text-[15px] sm:text-base font-bold mt-3 mb-1 break-words ${isDark ? "text-amber-400" : "text-amber-800"}`}>
              {renderBoldText(trimmed.replace("#### ", ""), isDark)}
            </h4>
          );
        }
        if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
          const itemText = trimmed.substring(2);
          return (
            <div key={idx} className={`flex items-start gap-2.5 pl-1.5 sm:pl-2 py-1 rounded-lg ${isDark ? "hover:bg-slate-800/40" : "hover:bg-slate-100/60"} transition-colors min-w-0`}>
              <span className={`font-bold mt-1.5 text-[10px] shrink-0 ${isDark ? "text-amber-400" : "text-amber-600"}`}>•</span>
              <div className={`flex-1 min-w-0 break-words ${isDark ? "text-slate-200" : "text-slate-800"}`}>{renderBoldText(itemText, isDark)}</div>
            </div>
          );
        }
        if (/^\d+\.\s+/.test(trimmed)) {
          const numMatch = trimmed.match(/^(\d+\.)\s+(.*)$/);
          const numLabel = numMatch ? numMatch[1] : trimmed.substring(0, 2);
          const itemBody = numMatch ? numMatch[2] : trimmed.substring(3);
          return (
            <div key={idx} className="flex items-start gap-2 pl-1.5 sm:pl-2 font-medium min-w-0">
              <span className={`font-bold shrink-0 tabular-nums ${isDark ? "text-amber-400" : "text-slate-800"}`}>{numLabel}</span>
              <div className={`flex-1 my-0 min-w-0 break-words ${isDark ? "text-slate-200" : "text-slate-800"}`}>{renderBoldText(itemBody, isDark)}</div>
            </div>
          );
        }
        if (trimmed === "---") {
          return <hr key={idx} className={`my-5 ${isDark ? "border-slate-700" : "border-slate-200"}`} />;
        }
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        // Markdown image support (e.g. diagrams and figures extracted from slides)
        const imgMatch = trimmed.match(/!\[([^\]]*)\]\((data:image\/[^)]+)\)/);
        if (imgMatch) {
          const alt = imgMatch[1];
          const src = imgMatch[2];
          const parts = trimmed.split(imgMatch[0]);
          return (
            <div key={idx} className="my-3">
              {parts[0] && <p className={`my-1 break-words ${isDark ? "text-slate-200" : "text-slate-800"}`}>{renderBoldText(parts[0], isDark)}</p>}
              <div className="my-3 flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl bg-slate-900/80 border border-slate-700 shadow-md">
                <img src={src} alt={alt || "Slide Figure"} className="max-h-[400px] max-w-full object-contain rounded-lg shadow-sm bg-white/5 p-1.5" />
                {alt && alt !== "Slide Diagram" && alt !== "Slide Figure" && (
                  <span className="text-[11px] text-slate-400 mt-1.5 italic text-center">{alt}</span>
                )}
              </div>
              {parts[1] && <p className={`my-1 break-words ${isDark ? "text-slate-200" : "text-slate-800"}`}>{renderBoldText(parts[1], isDark)}</p>}
            </div>
          );
        }

        // Check if line represents a figure or diagram caption
        const isFigure = /^(Fig(?:ure|\.)?)\s*[\d\.\-\:]+/i.test(trimmed) || 
                         trimmed.toLowerCase().startsWith("fig ") || 
                         trimmed.toLowerCase().startsWith("fig.") || 
                         trimmed.toLowerCase().startsWith("figure ");

        if (isFigure) {
          return <FigureCard key={idx} rawLine={trimmed} />;
        }

        return <p key={idx} className={`my-1.5 break-words ${isDark ? "text-slate-200" : "text-slate-800"}`}>{renderBoldText(trimmed, isDark)}</p>;
      })}
    </div>
  );
};

function renderBoldText(rawText: string, isDark: boolean = false) {
  const text = (rawText || "")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  const parts = text.split(/(\[.*?\]\(https?:\/\/[^\)]+\)|\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, i) => {
    const linkMatch = part.match(/^\[(.*?)\]\((https?:\/\/.*?)\)$/);
    if (linkMatch) {
      const linkText = linkMatch[1];
      const linkUrl = linkMatch[2];
      return (
        <a
          key={i}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all shadow-xs my-1 ${
            isDark 
              ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40" 
              : "bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300"
          }`}
        >
          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          <span>{linkText}</span>
        </a>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className={`font-bold ${isDark ? "text-white" : "text-slate-950"}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i} className="italic">{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

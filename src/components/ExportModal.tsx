import React, { useState } from "react";
import { Download, Printer, X, FileCode, CheckCircle2, Layers } from "lucide-react";
import { NoteDocument } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  notes?: NoteDocument[];
  document?: NoteDocument;
}

export const ExportModal: React.FC<Props> = ({ isOpen, onClose, notes: propsNotes, document }) => {
  const [downloadedNoteId, setDownloadedNoteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const notes = (propsNotes && propsNotes.length > 0 ? propsNotes : (document ? [document] : [])) as NoteDocument[];

  const generateSingleNoteHtml = (note: NoteDocument) => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${note.title}</title>
  <style>
    @media print {
      body { margin: 1cm; font-size: 11pt; }
      .no-print { display: none !important; }
    }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; max-width: 900px; margin: 40px auto; padding: 0 20px; color: #0f172a; background: #ffffff; }
    h1 { color: #0f172a; border-bottom: 3px solid #f59e0b; padding-bottom: 8px; margin-bottom: 4px; font-size: 24px; }
    .subtitle { color: #64748b; font-size: 14px; margin-bottom: 24px; font-style: italic; }
    h2 { color: #d97706; margin-top: 28px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; font-size: 18px; }
    .page-tag { background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; display: inline-block; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
    th { background: #0f172a; color: #ffffff; }
    pre { background: #0f172a; color: #f8fafc; padding: 14px; border-radius: 6px; overflow-x: auto; font-size: 12px; font-family: monospace; }
    code { font-family: monospace; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: #0f172a; font-size: 12px; }
  </style>
</head>
<body>
  <h1>${note.title}</h1>
  <div class="subtitle">${note.description || ""} (${note.pageCount || 1} Pages)</div>
  ${(note.sections || []).map(s => `
    <div style="margin-bottom: 32px;">
      <span class="page-tag">Page ${s.pageNumber}</span>
      <h2>${s.title}</h2>
      ${s.subtitle ? `<div style="color: #64748b; font-size: 13px; margin-bottom: 12px;">${s.subtitle}</div>` : ''}
      <div>${(s.contentMarkdown || "").replace(/\n/g, "<br>")}</div>
    </div>
  `).join("")}
</body>
</html>`;
  };

  const handlePrintSingleNote = (note: NoteDocument) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(generateSingleNoteHtml(note));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  const handleDownloadSingleNote = (note: NoteDocument) => {
    const htmlContent = generateSingleNoteHtml(note);
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${note.shortTitle.replace(/[^a-zA-Z0-9]/g, "_")}_AWS_Notes.html`;
    a.click();
    setDownloadedNoteId(note.id);
    setTimeout(() => setDownloadedNoteId(null), 3000);
  };

  const handlePrintAllSeparately = () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AWS Cloud Notes - All 4 Notes (Separated)</title>
  <style>
    @media print {
      body { margin: 1cm; font-size: 11pt; }
      .note-break { page-break-before: always; break-before: page; }
    }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; max-width: 900px; margin: 40px auto; padding: 0 20px; color: #0f172a; }
    h1 { color: #0f172a; border-bottom: 3px solid #f59e0b; padding-bottom: 8px; font-size: 24px; }
    .subtitle { color: #64748b; font-size: 14px; margin-bottom: 24px; font-style: italic; }
    h2 { color: #d97706; margin-top: 28px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; font-size: 18px; }
    .page-tag { background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; display: inline-block; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
    th { background: #0f172a; color: #ffffff; }
  </style>
</head>
<body>
  ${(notes || []).map((note, index) => `
    <div class="${index > 0 ? 'note-break' : ''}" style="${index > 0 ? 'margin-top: 40px;' : ''}">
      <h1>${note.title}</h1>
      <div class="subtitle">${note.description || ""} (${note.pageCount || 1} Pages)</div>
      ${(note.sections || []).map(s => `
        <div style="margin-bottom: 32px;">
          <span class="page-tag">Page ${s.pageNumber}</span>
          <h2>${s.title}</h2>
          ${s.subtitle ? `<div style="color: #64748b; font-size: 13px; margin-bottom: 12px;">${s.subtitle}</div>` : ''}
          <div>${(s.contentMarkdown || "").replace(/\n/g, "<br>")}</div>
        </div>
      `).join("")}
    </div>
  `).join("")}
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  const handleDownloadAllSeparately = () => {
    notes.forEach((note, index) => {
      setTimeout(() => {
        handleDownloadSingleNote(note);
      }, index * 400);
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-2 sm:p-4 pb-safe">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-4 sm:p-6 space-y-4 sm:space-y-5 text-xs max-h-[88dvh] overflow-y-auto">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm min-w-0">
            <Printer className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="truncate">Print & Export Notes</span>
          </span>
          <button
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            aria-label="Close Export Modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
          Print or download each lecture note individually, or print all with clean page breaks between notes.
        </p>

        {/* Global Bulk Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
          <button
            onClick={handlePrintAllSeparately}
            className="min-h-[44px] p-3 bg-amber-500 text-slate-950 font-bold rounded-xl flex items-center justify-between hover:bg-amber-400 transition-colors shadow-xs cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Printer className="w-4 h-4 shrink-0" /> Print All Notes
            </span>
            <span className="text-[10px] bg-slate-950/10 px-1.5 py-0.5 rounded">PDF</span>
          </button>

          <button
            onClick={handleDownloadAllSeparately}
            className="min-h-[44px] p-3 bg-slate-800 dark:bg-slate-800 text-slate-100 font-bold rounded-xl flex items-center justify-between hover:bg-slate-700 transition-colors shadow-xs cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Download className="w-4 h-4 text-amber-400 shrink-0" /> Download All (.html)
            </span>
            <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded">{notes.length} Files</span>
          </button>
        </div>

        {/* Individual Note Cards */}
        <div className="space-y-3 pt-1">
          <div className="font-semibold text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-amber-500" /> Individual Notes ({notes.length}):
          </div>

          <div className="space-y-2.5">
            {(notes || []).map((note) => (
              <div
                key={note.id}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate">
                    {note.title}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {note.pageCount || 1} {(note.pageCount || 1) === 1 ? "Page" : "Pages"} · {note.sections?.length || 0} Core Topics
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handlePrintSingleNote(note)}
                    className="flex-1 sm:flex-initial min-h-[40px] sm:min-h-[34px] px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors text-xs cursor-pointer"
                    title={`Print ${note.shortTitle} only`}
                  >
                    <Printer className="w-3.5 h-3.5" /> Print
                  </button>

                  <button
                    onClick={() => handleDownloadSingleNote(note)}
                    className="flex-1 sm:flex-initial min-h-[40px] sm:min-h-[34px] px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors text-xs cursor-pointer"
                    title={`Download HTML for ${note.shortTitle}`}
                  >
                    {downloadedNoteId === note.id ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Saved!
                      </>
                    ) : (
                      <>
                        <FileCode className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> HTML
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};


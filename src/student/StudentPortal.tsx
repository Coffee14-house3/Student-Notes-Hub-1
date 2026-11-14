import React, { useState } from "react";
import { 
  BookOpen, HelpCircle, Search, 
  Tag, Clock, ChevronRight, Layers, FileText, ArrowRight,
  GraduationCap, Bell, ArrowUpRight, Award, Folder, RefreshCw, CheckCircle2, Upload
} from "lucide-react";
import { NoteDocument, CourseAnnouncement } from "../types";

interface Props {
  documents: NoteDocument[];
  announcements?: CourseAnnouncement[];
  onSelectDocument: (docId: string, openAiChat?: boolean) => void;
  onOpenQuiz: (docId?: string) => void;
  onOpenSearch: () => void;
  onOpenAiTutor?: () => void;
  isStandalone?: boolean;
  onSyncWithTeacher?: () => Promise<void> | void;
  onSwitchPortal?: (mode: "student" | "teacher") => void;
  isSyncing?: boolean;
  syncStatus?: string | null;
}

export const StudentPortal: React.FC<Props> = ({
  documents,
  announcements = [],
  onSelectDocument,
  onOpenQuiz,
  onOpenSearch,
  onOpenAiTutor,
  isStandalone = false,
  onSyncWithTeacher,
  onSwitchPortal,
  isSyncing = false,
  syncStatus = null
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>("all");
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string>("all");

  // Filter only published documents for students
  const publishedDocs = (documents || []).filter((doc) => doc.isPublished !== false);

  // Extract distinct subjects
  const availableSubjects = Array.from(
    new Set(publishedDocs.map((d) => d.subject).filter(Boolean))
  ) as string[];

  // Extract distinct units
  const availableUnits = Array.from(
    new Set(
      publishedDocs
        .map((d) => d.unit || (d.unitNumber ? `Unit ${d.unitNumber}` : undefined))
        .filter(Boolean)
    )
  ) as string[];

  // Filter documents
  const filteredDocs = publishedDocs.filter((doc) => {
    const matchesSubject =
      selectedSubjectFilter === "all" || doc.subject === selectedSubjectFilter;
    const docUnit = doc.unit || (doc.unitNumber ? `Unit ${doc.unitNumber}` : "");
    const matchesUnit =
      selectedUnitFilter === "all" || docUnit === selectedUnitFilter;
    const matchesSearch =
      searchQuery.trim() === "" ||
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.shortTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.tags && doc.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchesSubject && matchesUnit && matchesSearch;
  });

  // Group filtered documents by Subject
  const groupedBySubject = filteredDocs.reduce((acc, doc) => {
    const subj = doc.subject || "General Course Materials";
    if (!acc[subj]) acc[subj] = [];
    acc[subj].push(doc);
    return acc;
  }, {} as Record<string, NoteDocument[]>);

  // Calculate total pages / reading items
  const totalPages = publishedDocs.reduce((sum, d) => sum + (d.pageCount || d.sections?.length || 1), 0);

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900 selection:bg-amber-100 selection:text-amber-900">
      
      {/* Top Banner / Hero */}
      <div className="border-b border-slate-200 bg-white shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-9">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
            <div className="space-y-1.5 sm:space-y-2">
              <div className="flex items-center gap-2 text-amber-700 text-xs font-semibold">
                <GraduationCap className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Course Materials</span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="text-slate-500 font-medium tabular-nums">
                  {publishedDocs.length} {publishedDocs.length === 1 ? "Document" : "Documents"} · {totalPages} Pages
                </span>
              </div>
              <h1 className="text-xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                Course Materials & Study Hub
              </h1>
              <p className="text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
                Browse verified course notes uploaded by your instructor. Read materials and practice interactive quizzes.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3">
              {onSyncWithTeacher && (
                <button
                  onClick={() => onSyncWithTeacher()}
                  disabled={isSyncing}
                  className="w-full sm:w-auto min-h-[44px] sm:min-h-[40px] px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-amber-500 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50 whitespace-nowrap shrink-0"
                  title="Sync and refresh notes from the instructor portal"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-amber-500 ${isSyncing ? "animate-spin" : ""}`} />
                  <span>{isSyncing ? "Syncing..." : "Sync Notes"}</span>
                </button>
              )}

              {syncStatus && (
                <span className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{syncStatus}</span>
                </span>
              )}
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="mt-5 sm:mt-8 pt-4 sm:pt-6 border-t border-slate-200 flex flex-col md:flex-row items-stretch md:items-center gap-2.5 sm:gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search topics, keywords, concepts..."
                className="w-full min-h-[44px] pl-10 pr-14 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm sm:text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-amber-500 focus:bg-white transition-colors shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-slate-500 hover:text-slate-800 text-xs font-medium min-h-[32px]"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Subject & Unit Filters (2-column grid on mobile, inline row on desktop) */}
            {(availableSubjects.length > 0 || availableUnits.length > 0) && (
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5">
                {availableSubjects.length > 0 && (
                  <select
                    value={selectedSubjectFilter}
                    onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                    className="w-full sm:w-auto min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm sm:text-xs text-slate-800 focus:outline-hidden focus:border-amber-500 cursor-pointer shadow-xs truncate"
                    aria-label="Filter by Subject"
                  >
                    <option value="all">All Subjects ({availableSubjects.length})</option>
                    {availableSubjects.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                )}

                {availableUnits.length > 0 && (
                  <select
                    value={selectedUnitFilter}
                    onChange={(e) => setSelectedUnitFilter(e.target.value)}
                    className="w-full sm:w-auto min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm sm:text-xs text-slate-800 focus:outline-hidden focus:border-amber-500 cursor-pointer shadow-xs truncate"
                    aria-label="Filter by Unit"
                  >
                    <option value="all">All Units ({availableUnits.length})</option>
                    {availableUnits.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 sm:space-y-8 pb-safe">
        
        {/* Course Announcements (if any) */}
        {announcements && announcements.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
              <Bell className="w-3.5 h-3.5 text-amber-600" />
              <span>Instructor Announcements</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(announcements || []).map((ann) => (
                <div
                  key={ann.id}
                  className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl relative overflow-hidden shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <h4 className="font-bold text-sm text-slate-900">{ann.title}</h4>
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">{ann.content}</p>
                    </div>
                    <span className="text-[11px] text-slate-500 shrink-0 font-medium tabular-nums">{ann.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes Grid by Subject */}
        {publishedDocs.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 text-center space-y-4 max-w-lg mx-auto my-8 sm:my-12 shadow-xs">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <BookOpen className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-slate-900">No Course Notes Published Yet</h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                No course notes have been published for this curriculum yet. Please check back soon or consult your instructor for updates.
              </p>
            </div>
          </div>
        ) : Object.keys(groupedBySubject).length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 text-center space-y-3 shadow-xs">
            <p className="text-sm text-slate-600">No documents match the filter "{searchQuery}".</p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedSubjectFilter("all");
                setSelectedUnitFilter("all");
              }}
              className="min-h-[44px] px-5 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          (Object.entries(groupedBySubject) as [string, NoteDocument[]][]).map(([subject, docs]) => (
            <div key={subject} className="space-y-3.5 sm:space-y-4">
              {/* Subject Section Header */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">{subject}</h2>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="text-xs text-slate-500 font-medium tabular-nums shrink-0">{docs.length} {docs.length === 1 ? "note" : "notes"}</span>
                </div>
              </div>

              {/* Subject Notes Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="group bg-white hover:bg-slate-50/60 border border-slate-200 hover:border-amber-400 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 shadow-xs hover:shadow-md"
                  >
                    <div className="space-y-2.5 sm:space-y-3">
                      {/* Clean Metadata Header */}
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                        <div className="flex items-center gap-2 min-w-0">
                          <BookOpen className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="font-semibold text-slate-700 truncate">
                            {doc.unit || (doc.unitNumber ? `Unit ${doc.unitNumber}` : "Course Note")}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-slate-500 tabular-nums shrink-0">
                          {doc.pageCount || doc.sections?.length || 1} {(doc.pageCount || doc.sections?.length || 1) === 1 ? "page" : "pages"}
                        </span>
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h3 className="font-bold text-base sm:text-sm text-slate-900 group-hover:text-amber-700 transition-colors line-clamp-2 leading-snug">
                          {doc.title}
                        </h3>
                        <p className="text-xs sm:text-xs text-slate-600 mt-1.5 line-clamp-3 leading-relaxed">
                          {doc.description}
                        </p>
                      </div>

                      {/* Clean Unboxed Tags */}
                      {doc.tags && doc.tags.length > 0 && (
                        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[11px] text-slate-500 pt-0.5">
                          {doc.tags.slice(0, 3).map((t, idx) => (
                            <React.Fragment key={idx}>
                              {idx > 0 && <span aria-hidden="true" className="text-slate-300">·</span>}
                              <span>{t}</span>
                            </React.Fragment>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Footer (Full-height thumb-friendly targets on mobile) */}
                    <div className="pt-3.5 mt-4 border-t border-slate-100 flex items-center justify-between gap-2.5">
                      <button
                        onClick={() => onOpenQuiz(doc.id)}
                        className="flex-1 sm:flex-initial min-h-[42px] sm:min-h-[36px] px-3 py-2 rounded-xl sm:rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-200 whitespace-nowrap"
                        title="Take practice quiz for this note"
                      >
                        <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Quiz</span>
                      </button>

                      <button
                        onClick={() => onSelectDocument(doc.id, false)}
                        className="flex-[1.5] sm:flex-initial min-h-[42px] sm:min-h-[36px] px-4 py-2 rounded-xl sm:rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs whitespace-nowrap"
                      >
                        <span>Read Note</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {/* Student Portal Footer */}
        <div className="pt-8 sm:pt-12 pb-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Student Notes Hub — Verified Course Materials</span>
          </div>
          <div className="text-slate-500 text-[11px]">
            Interactive Course Notes Active
          </div>
        </div>

      </div>
    </div>
  );
};

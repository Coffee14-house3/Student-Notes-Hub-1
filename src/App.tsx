import React, { useState, useEffect } from "react";
import { StudentApp } from "./student/StudentApp";
import { TeacherApp } from "./teacher/TeacherApp";
import { AppPortalMode } from "./types";
import { apiFetch, setBackendUrl, getBackendUrl } from "./utils/apiClient";

// Detect portal mode: URL hash has highest priority for GitHub Pages SPA (#/student, #/faculty)
function getPortalModeFromLocation(): AppPortalMode {
  try {
    if (typeof window === "undefined") return "student";

    // 1. Hash check (Highest priority for GitHub Pages: #/student, #/faculty, #/teacher)
    const hash = window.location.hash.toLowerCase();
    if (hash.includes("faculty") || hash.includes("teacher")) return "teacher";
    if (hash.includes("student")) return "student";

    // 2. Explicit query parameter (?portal=faculty, ?portal=teacher or ?portal=student)
    const params = new URLSearchParams(window.location.search);
    const portalParam = params.get("portal")?.toLowerCase().trim();
    if (portalParam === "faculty" || portalParam === "teacher") return "teacher";
    if (portalParam === "student") return "student";

    // 3. Path or file check (e.g. /faculty, /teacher, /teacher.html, /student)
    const path = window.location.pathname.toLowerCase();
    if (path.includes("faculty") || path.includes("teacher")) return "teacher";
    if (path.includes("student")) return "student";

    // 4. Hostname check (e.g., student.domain.com, faculty.domain.com)
    const host = window.location.hostname.toLowerCase();
    if (host.includes("faculty") || host.includes("teacher")) return "teacher";
    if (host.includes("student")) return "student";

    // 5. Vite build-time environment variable
    const vitePortal = String((import.meta as any).env?.VITE_PORTAL_MODE || "").toLowerCase().trim();
    if (vitePortal === "faculty" || vitePortal === "teacher") return "teacher";
    if (vitePortal === "student") return "student";
  } catch {
    // ignore
  }
  return "student"; // Default to student view for class
}

export default function App() {
  const [portalMode, setPortalMode] = useState<AppPortalMode>(getPortalModeFromLocation);

  // Switch portal and update URL hash to match GitHub Pages clean direct links (#/student and #/faculty)
  const handleSwitchPortal = (mode: AppPortalMode) => {
    setPortalMode(mode);
    try {
      window.location.hash = mode === "teacher" ? "/faculty" : "/student";
    } catch {
      // ignore
    }
  };

  // Sync initial hash so browser displays direct link format immediately (#/student or #/faculty)
  // and listen for hash changes (e.g., user typing #/faculty or browser back/forward buttons)
  useEffect(() => {
    try {
      const currentHash = window.location.hash.toLowerCase();
      if (!currentHash || currentHash === "#" || currentHash === "#/") {
        window.location.hash = portalMode === "teacher" ? "/faculty" : "/student";
      }
    } catch {
      // ignore
    }

    const handleHashChange = () => {
      const mode = getPortalModeFromLocation();
      setPortalMode(mode);
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [portalMode]);

  // Track if running in locked mode (only when explicitly requested via ?lock=true or lock=student)
  const [isStandalone, setIsStandalone] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("lock") === "student" || params.get("lock") === "true") return true;

      const viteStandalone = String((import.meta as any).env?.VITE_STANDALONE || "").toLowerCase().trim();
      if (viteStandalone === "locked" || viteStandalone === "strict") return true;
    } catch {
      // ignore
    }
    return false;
  });

  // Sync server configuration on mount without overriding user explicit URL param or hash
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const hash = window.location.hash.toLowerCase();
        const params = new URLSearchParams(window.location.search);
        const hasExplicitPortal = 
          hash.includes("student") || 
          hash.includes("faculty") || 
          hash.includes("teacher") || 
          params.has("portal") || 
          window.location.pathname.toLowerCase().includes("teacher") || 
          window.location.pathname.toLowerCase().includes("student");

        const res = await apiFetch("/api/config");
        if (res.ok) {
          const data = await res.json();
          if (data.teacherBackendUrl && !getBackendUrl()) {
            setBackendUrl(data.teacherBackendUrl);
          }
          if (data.isStandalone && !hasExplicitPortal) {
            setIsStandalone(true);
            if (data.portalMode === "student") {
              setPortalMode("student");
            } else if (data.portalMode === "teacher") {
              setPortalMode("teacher");
            }
          }
        }
      } catch {
        // fallback
      }
    };
    fetchConfig();
  }, []);

  // Render dedicated Student Application or Teacher/Faculty Application
  if (portalMode === "teacher") {
    return (
      <TeacherApp 
        isStandalone={isStandalone} 
        onSwitchPortal={handleSwitchPortal} 
      />
    );
  }

  return (
    <StudentApp 
      isStandalone={isStandalone} 
      onSwitchPortal={handleSwitchPortal} 
    />
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Home as HomeIcon, Menu } from "lucide-react";
import AppSidebar from "./AppSidebar";

export default function AuthenticatedShell({ children }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={`home-shell app-shell ${sidebarOpen ? "sidebar-is-open" : ""}`}>
      <button
        className="home-sidebar-overlay"
        type="button"
        aria-label="Close navigation"
        onClick={() => setSidebarOpen(false)}
      />

      <AppSidebar onClose={() => setSidebarOpen(false)} />

      <div className="home-content app-shell-content">
        <header className="app-shell-mobile-bar">
          <button
            className="home-menu-button"
            type="button"
            aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((open) => !open)}
          >
            <Menu size={21} />
          </button>
          <div>
            <span>Arena navigation</span>
            <strong>Switch pages</strong>
          </div>
          <div className="app-shell-nav-actions">
            <button
              className="app-shell-nav-button"
              type="button"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <button
              className="app-shell-nav-button"
              type="button"
              onClick={() => navigate("/home")}
            >
              <HomeIcon size={16} />
              Home
            </button>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}

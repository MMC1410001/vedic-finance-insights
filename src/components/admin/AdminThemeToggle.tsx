/**
 * Compact Cosmic/Vedic switch for the admin header.
 *
 * KundaliThemeSwitcher is not reusable here: it reads useKundaliTheme() (the
 * wrong provider) and its expanded form is a sidebar-width block with a Sanskrit
 * footer. The Sun/Moon cross-fade below is lifted from that component's collapsed
 * variant, resized to a 44px header target.
 */

import { Moon, Sun } from "lucide-react";
import { useAdminTheme } from "@/lib/admin-theme-context";

export function AdminThemeToggle() {
  const { isVedic, toggleTheme } = useAdminTheme();
  const target = isVedic ? "Cosmic (dark)" : "Vedic (light)";

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${target} theme`}
      aria-pressed={isVedic}
      title={`Switch to ${target} theme`}
      className="relative grid place-items-center min-h-[44px] min-w-[44px] rounded-lg
                 text-admin-text-muted hover:text-admin-text hover:bg-admin-surface-2
                 border border-admin-border-subtle transition-colors shrink-0"
    >
      {/* Both icons stay mounted and cross-fade, so the control never reflows. */}
      <Sun
        className="w-4 h-4 absolute transition-all duration-500"
        style={{
          opacity: isVedic ? 1 : 0,
          transform: isVedic ? "rotate(0deg) scale(1)" : "rotate(90deg) scale(0.5)",
        }}
      />
      <Moon
        className="w-4 h-4 absolute transition-all duration-500"
        style={{
          opacity: isVedic ? 0 : 1,
          transform: isVedic ? "rotate(-90deg) scale(0.5)" : "rotate(0deg) scale(1)",
        }}
      />
    </button>
  );
}

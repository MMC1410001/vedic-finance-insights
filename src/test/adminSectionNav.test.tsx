import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { ADMIN_SECTIONS } from "@/components/admin/admin-sections";
import { AdminSectionPills, AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminSection } from "@/components/admin/AdminSection";
import { edgeSectionId, pickActiveEntry } from "@/hooks/useAdminSectionNav";

/**
 * The section nav is only as good as the agreement between four things: the
 * sidebar rows, the mobile pills, the scroll-spy observer and the `<section id>`
 * anchors. All four read ADMIN_SECTIONS, so what needs guarding is that the
 * array stays well-formed and that the highlight picks the right section when
 * two are on screen at once.
 */

const entry = (id: string, top: number, isIntersecting = true) =>
  ({
    isIntersecting,
    boundingClientRect: { top } as DOMRect,
    target: { id } as Element,
  }) as IntersectionObserverEntry;

describe("ADMIN_SECTIONS", () => {
  it("has unique ids", () => {
    const ids = ADMIN_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers the six groupings in order", () => {
    expect(ADMIN_SECTIONS.map((s) => s.label)).toEqual([
      // Overview is operational health; Analytics is behaviour. They were one
      // section until the second grew its own dashboard.
      "Overview",
      "Analytics",
      "IP Addresses",
      "Admin Kundalis",
      "Kundalis Generated",
      "Users",
    ]);
  });
});

describe("pickActiveEntry", () => {
  it("picks the topmost intersecting section, not the last one reported", () => {
    // The /kundali scroll-spy calls setActive for every intersecting entry, so
    // the lower section wins purely by callback order. This is that bug.
    expect(pickActiveEntry([entry("admin-users", 400), entry("admin-ips", 20)])).toBe("admin-ips");
  });

  it("ignores sections that have left the band", () => {
    expect(
      pickActiveEntry([entry("admin-analytics", -500, false), entry("admin-ips", 40)]),
    ).toBe("admin-ips");
  });

  it("returns null when nothing is intersecting, so the caller keeps the current section", () => {
    expect(pickActiveEntry([entry("admin-ips", 900, false)])).toBeNull();
  });
});

describe("edgeSectionId", () => {
  // 900px viewport on a 4000px page.
  it("claims the first section at the top of the page", () => {
    expect(edgeSectionId(0, 900, 4000)).toBe("admin-overview");
    expect(edgeSectionId(20, 900, 4000)).toBe("admin-overview");
  });

  it("claims the last section at the bottom of the page", () => {
    // Measured bug: free-scrolling to the end left "Admin Kundalis" highlighted,
    // because the final headings sit below the observer band and never enter it.
    expect(edgeSectionId(3100, 900, 4000)).toBe("admin-users");
  });

  it("stays out of the way in the middle, leaving the observer in charge", () => {
    expect(edgeSectionId(1500, 900, 4000)).toBeNull();
  });

  it("does not claim the bottom while there is still a screenful to scroll", () => {
    expect(edgeSectionId(2000, 900, 4000)).toBeNull();
  });
});

describe("nav rendering", () => {
  it("renders every section in both the sidebar and the pills", () => {
    const onSelect = vi.fn();
    render(
      <MemoryRouter>
        <AdminSidebar active="admin-ips" onSelect={onSelect} collapsed={false} onToggleCollapse={() => {}} />
        <AdminSectionPills active="admin-ips" onSelect={onSelect} />
      </MemoryRouter>,
    );

    for (const section of ADMIN_SECTIONS) {
      // One row in the sidebar, one pill in the strip.
      expect(screen.getAllByText(section.label)).toHaveLength(2);
    }
  });

  it("marks only the active section as current", () => {
    render(
      <MemoryRouter>
        <AdminSectionPills active="admin-users" onSelect={() => {}} />
      </MemoryRouter>,
    );
    const current = screen.getAllByRole("button").filter((b) => b.getAttribute("aria-current"));
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain("Users");
  });

  it("hides its labels when collapsed so the rail is icon-only", () => {
    render(
      <MemoryRouter>
        <AdminSidebar active="admin-analytics" onSelect={() => {}} collapsed onToggleCollapse={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.queryByText("Kundalis Generated")).toBeNull();
    // Still reachable — the label moves to a tooltip, not out of existence.
    expect(screen.getByTitle("Kundalis Generated")).toBeTruthy();
  });

  it("calls onSelect with the section id", () => {
    const onSelect = vi.fn();
    render(
      <MemoryRouter>
        <AdminSectionPills active="admin-analytics" onSelect={onSelect} />
      </MemoryRouter>,
    );
    screen.getByText("Users").click();
    expect(onSelect).toHaveBeenCalledWith("admin-users");
  });
});

describe("AdminSection", () => {
  it("renders an anchor whose id the nav can target, and keeps scroll-margin", () => {
    const { icon, id, label } = ADMIN_SECTIONS.find((s) => s.id === "admin-ips")!;
    render(
      <AdminSection id={id} label={label} icon={icon}>
        <p>body</p>
      </AdminSection>,
    );

    const el = document.getElementById(id);
    expect(el).toBeTruthy();
    // scrollIntoView lands wrong without these; they are behaviour, not styling.
    expect(el?.className).toContain("scroll-mt-");
    expect(screen.getByText("IP Addresses")).toBeTruthy();
    expect(screen.getByText("body")).toBeTruthy();
  });
});

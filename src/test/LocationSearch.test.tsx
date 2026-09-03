/**
 * Tests for the birth-place autocomplete contract (AF-091).
 *
 * The bug was filed as "birthplace is case sensitive". It isn't — Nominatim is
 * case-insensitive. The real defect was that typing never propagated to the
 * form at all: only clicking a suggestion did, so submitting typed text failed
 * silently with an empty birth_place. These lock in the split contract:
 *   onTextChange -> every keystroke, no coordinates
 *   onChange     -> selection only, carries coordinates
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import LocationSearch from "../components/vedicfinance/LocationSearch";

const PUNE = {
  display_name: "Pune, Pune District, Maharashtra, India",
  lat: "18.5204",
  lon: "73.8567",
};

function mockNominatim(results: unknown[] = [PUNE]) {
  const fetchMock = vi.fn().mockResolvedValue({
    json: async () => results,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("LocationSearch", () => {
  it("reports typed text on every keystroke without coordinates", () => {
    mockNominatim();
    const onChange = vi.fn();
    const onTextChange = vi.fn();

    render(<LocationSearch value="" onChange={onChange} onTextChange={onTextChange} />);
    fireEvent.change(screen.getByPlaceholderText("Search your birth place"), {
      target: { value: "pune" },
    });

    expect(onTextChange).toHaveBeenCalledWith("pune");
    // Coordinates only exist after a selection — typing must not fake them.
    expect(onChange).not.toHaveBeenCalled();
  });

  it("searches lowercase input and fires onChange with coordinates on select", async () => {
    const fetchMock = mockNominatim();
    const onChange = vi.fn();

    render(<LocationSearch value="" onChange={onChange} onTextChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Search your birth place"), {
      target: { value: "pune" },
    });

    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    const suggestion = await screen.findByText(PUNE.display_name);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("q=pune");

    fireEvent.click(suggestion);

    expect(onChange).toHaveBeenCalledTimes(1);
    const [place, lat, lon, tz] = onChange.mock.calls[0];
    expect(place).toBe(PUNE.display_name);
    expect(lat).toBeCloseTo(18.5204, 4);
    expect(lon).toBeCloseTo(73.8567, 4);
    expect(tz).toBe(5.5); // India bounding box
  });

  it("trims and collapses whitespace before querying", async () => {
    const fetchMock = mockNominatim();

    render(<LocationSearch value="" onChange={vi.fn()} onTextChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Search your birth place"), {
      target: { value: "  new   delhi  " },
    });

    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(decodeURIComponent(String(fetchMock.mock.calls[0][0]))).toContain("q=new delhi");
  });

  it("does not query for a single character", async () => {
    const fetchMock = mockNominatim();

    render(<LocationSearch value="" onChange={vi.fn()} onTextChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Search your birth place"), {
      target: { value: "p" },
    });

    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the pick-from-list hint until a suggestion is selected", () => {
    mockNominatim();
    const { rerender } = render(
      <LocationSearch value="" onChange={vi.fn()} onTextChange={vi.fn()} selected={false} />,
    );
    expect(screen.getByText(/pick your birth place from the list/i)).toBeInTheDocument();

    rerender(
      <LocationSearch value={PUNE.display_name} onChange={vi.fn()} onTextChange={vi.fn()} selected />,
    );
    expect(screen.queryByText(/pick your birth place from the list/i)).not.toBeInTheDocument();
  });

  it("syncs a value supplied later (pre-fill / back-navigation)", () => {
    mockNominatim();
    const { rerender } = render(<LocationSearch value="" onChange={vi.fn()} />);
    const input = screen.getByPlaceholderText("Search your birth place") as HTMLInputElement;
    expect(input.value).toBe("");

    rerender(<LocationSearch value={PUNE.display_name} onChange={vi.fn()} />);
    expect(input.value).toBe(PUNE.display_name);
  });
});

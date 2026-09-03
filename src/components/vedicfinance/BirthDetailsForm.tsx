import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, User, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFormFieldTracking } from "@/lib/form-tracking";
import { Label } from "@/components/ui/label";
import LocationSearch from "./LocationSearch";
import type { ReportRequest } from "@/lib/vedicfinance-types";
import analytics from "@/lib/analytics";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const NAME_REGEX = /^[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF' \-]+$/;

const formSchema = z.object({
  full_name: z.string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .regex(NAME_REGEX, "Name can only contain letters, spaces, hyphens, and apostrophes")
    .refine((val) => !/\s{2,}/.test(val), "Name cannot have consecutive spaces")
    .refine((val) => /[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]{2,}/.test(val), "Name must contain at least 2 letters")
    // Apostrophe rules
    .refine((val) => !val.startsWith("'"), "Name cannot start with an apostrophe")
    .refine((val) => !val.endsWith("'"), "Name cannot end with an apostrophe")
    .refine((val) => !val.includes("''"), "Name cannot have consecutive apostrophes")
    .refine((val) => {
      // Apostrophe must be between letters only (e.g. O'Brien), not adjacent to space or hyphen
      return !/'[\s\-]|[\s\-]'/.test(val);
    }, "Apostrophe must appear between letters (e.g. O'Brien)"),
  birth_date: z.string().min(1, "Date of birth is required").refine(
    (val) => /^\d{4}-\d{2}-\d{2}$/.test(val),
    "Please enter a valid date (year must be 4 digits)"
  ).refine((val) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return true; // let previous refine handle format
    const [y, m, d] = val.split("-").map(Number);
    if (m < 1 || m > 12) return false;
    if (d < 1 || d > 31) return false;
    if (y < 1900) return false;
    // Validate day against month (accounts for leap years)
    const daysInMonth = new Date(y, m, 0).getDate();
    return d <= daysInMonth;
  }, "Please enter a valid date").refine((val) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return true;
    const entered = new Date(val + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return entered <= today;
  }, "Date of birth cannot be in the future"),
  birth_time: z.string().min(1, "Time of birth is required").refine((val) => {
    if (!/^\d{2}:\d{2}$/.test(val)) return false;
    const [h, m] = val.split(":").map(Number);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59;
  }, "Please enter a valid time"),
  birth_place: z.string().min(2, "Birth place is required"),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  timezone: z.coerce.number().min(-12).max(14),
});

type FormData = z.infer<typeof formSchema>;

interface Props {
  onSubmit: (data: ReportRequest) => void;
  loading: boolean;
  /** When true, show "Continue with Google" + "Skip" instead of a plain Continue button */
  showAuth?: boolean;
  onGoogleSignIn?: (data: ReportRequest) => void;
  onSkip?: (data: ReportRequest) => void;
  googleLoading?: boolean;
  authError?: string | null;
  /** When true, user is already signed in — show "Continue" instead of Google branding */
  isSignedIn?: boolean;
  /** Pre-fill form when navigating back */
  initialValues?: ReportRequest | null;
  /**
   * Replaces the label inside the submit button. Lets a caller put its own CTA
   * copy on the button while keeping it a real `type="submit"` inside this
   * form — no `form=` attribute plumbing, no second button to keep in sync.
   */
  submitContent?: React.ReactNode;
  /**
   * Fires on every press of the submit button, before validation runs. For
   * click-level analytics: `onSubmit` only runs once the form is valid, so a
   * caller measuring intent cannot use it.
   */
  onSubmitClick?: () => void;
  /** Tighter padding and no intro copy, for narrow columns. */
  compact?: boolean;
}

export default function BirthDetailsForm({
  onSubmit,
  loading,
  showAuth,
  onGoogleSignIn,
  googleLoading,
  authError,
  isSignedIn,
  initialValues,
  submitContent,
  onSubmitClick,
  compact = false,
}: Props) {
  const [locationSet, setLocationSet] = useState(!!initialValues?.birth_place);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [dateExpanded, setDateExpanded] = useState(!!initialValues?.birth_date);
  const [timeExpanded, setTimeExpanded] = useState(!!initialValues?.birth_time);
  const [nameSpecialCharWarning, setNameSpecialCharWarning] = useState(false);
  const nameWarningTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs for auto-focus between boxes
  const dateMonthRef = useRef<HTMLInputElement>(null);
  const dateYearRef = useRef<HTMLInputElement>(null);
  const timeMinRef = useRef<HTMLInputElement>(null);
  const ampmRef = useRef<HTMLButtonElement>(null);

  // Hidden native picker refs
  const hiddenDateRef = useRef<HTMLInputElement>(null);
  const hiddenTimeRef = useRef<HTMLInputElement>(null);

  // Split initial values for the boxes
  const getInitialDateParts = () => {
    if (initialValues?.birth_date) {
      const [y, m, d] = initialValues.birth_date.split("-");
      return { dd: d || "", mm: m || "", yyyy: y || "" };
    }
    return { dd: "", mm: "", yyyy: "" };
  };
  const getInitialTimeParts = () => {
    if (initialValues?.birth_time) {
      const parts = initialValues.birth_time.split(":");
      let hh = parseInt(parts[0] || "0", 10);
      const period = hh >= 12 ? "PM" : "AM";
      if (hh > 12) hh -= 12;
      if (hh === 0) hh = 12;
      return { hh: String(hh), min: parts[1] || "", period };
    }
    return { hh: "", min: "", period: "AM" as "AM" | "PM" };
  };

  const [dateParts, setDateParts] = useState(getInitialDateParts);
  const [timeParts, setTimeParts] = useState(getInitialTimeParts);

  const updateDateValue = (parts: { dd: string; mm: string; yyyy: string }) => {
    if (parts.dd && parts.mm && parts.yyyy && parts.yyyy.length === 4) {
      const formatted = `${parts.yyyy}-${parts.mm.padStart(2, "0")}-${parts.dd.padStart(2, "0")}`;
      form.setValue("birth_date", formatted, { shouldValidate: true });
    }
  };

  const updateTimeValue = (parts: { hh: string; min: string; period: string }) => {
    if (parts.hh && parts.min) {
      let hour24 = parseInt(parts.hh, 10);
      if (parts.period === "AM" && hour24 === 12) hour24 = 0;
      else if (parts.period === "PM" && hour24 !== 12) hour24 += 12;
      const formatted = `${String(hour24).padStart(2, "0")}:${parts.min.padStart(2, "0")}`;
      form.setValue("birth_time", formatted, { shouldValidate: true });
    }
  };

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      full_name: initialValues?.full_name ?? "",
      birth_date: initialValues?.birth_date ?? "",
      birth_time: initialValues?.birth_time ?? "",
      birth_place: initialValues?.birth_place ?? "",
      latitude: initialValues?.latitude ?? 0,
      longitude: initialValues?.longitude ?? 0,
      timezone: initialValues?.timezone ?? 5.5,
    },
  });

  const buildRequest = (data: FormData): ReportRequest => ({
    full_name: data.full_name,
    birth_date: data.birth_date,
    birth_time: data.birth_time,
    birth_time_accuracy: "exact",
    birth_place: data.birth_place,
    latitude: data.latitude,
    longitude: data.longitude,
    timezone: data.timezone,
  });

  /**
   * A typed birth place carries no coordinates — those only arrive when a
   * dropdown suggestion is clicked. Block submit with a message that names the
   * required action instead of failing on a generic "Birth place is required"
   * (AF-091). Mirrors the guard the admin form already uses.
   */
  const locationReady = () => {
    if (locationSet) return true;
    setLocationError(
      form.getValues("birth_place")?.trim()
        ? "Please select a location from the dropdown."
        : "Birth place is required.",
    );
    return false;
  };

  /**
   * One capture-phase focus listener for the whole form, rather than an onFocus on
   * each of the ten inputs. First-party only — see form-tracking.ts; nothing here
   * reaches dataLayer, GTM or GA4.
   */
  const fieldTracking = useFormFieldTracking("birth-details");

  const handleFormSubmit = form.handleSubmit((data) => {
    if (!locationReady()) return;
    onSubmit(buildRequest(data));
  });

  const handleGoogle = async () => {
    const valid = await form.trigger();
    if (!valid || !onGoogleSignIn) return;
    if (!locationReady()) return;
    onGoogleSignIn(buildRequest(form.getValues()));
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <form onSubmit={handleFormSubmit} {...fieldTracking} className={`rounded-2xl border space-y-4 ${compact ? "p-4 sm:p-5" : "p-7"}`} style={{ background: 'transparent', borderColor: 'rgba(26, 10, 46, 0.08)', boxShadow: 'none' }}>

        {/* Description — dropped in compact mode, where the surrounding section
            already explains what the form is for and vertical space is scarce. */}
        {!compact && (
          <p className="text-[13px] leading-relaxed pb-1" style={{ color: '#6B5C7A', fontFamily: "'Inter', sans-serif" }}>
            Enter your birth details to predict your financial success with Vedic astrology.
          </p>
        )}

        {/* Full Name — icon inside input */}
        <div className="space-y-1.5">
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#a22c1c' }} />
            <Input
              id="full_name"
              type="text"
              placeholder="Enter your full name"
              {...form.register("full_name", {
                onChange: (e) => {
                  const raw = e.target.value;
                  // Strip characters that aren't letters, spaces, hyphens, or apostrophes
                  const sanitized = raw.replace(/[^a-zA-Z\u00C0-\u024F\u1E00-\u1EFF' \-]/g, "");
                  if (sanitized !== raw) {
                    e.target.value = sanitized;
                    form.setValue("full_name", sanitized, { shouldValidate: true });
                    // Show warning when user attempts special chars
                    setNameSpecialCharWarning(true);
                    if (nameWarningTimeout.current) clearTimeout(nameWarningTimeout.current);
                    nameWarningTimeout.current = setTimeout(() => setNameSpecialCharWarning(false), 3000);
                  }
                },
              })}
              maxLength={100}
              className="h-12 pl-10 rounded-xl border"
              style={{ background: '#f6f4f2', borderColor: 'rgba(26, 10, 46, 0.12)', color: '#1A0A2E' }}
            />
          </div>
          {nameSpecialCharWarning && (
            <p className="text-xs pl-1 animate-fade-in" style={{ color: '#a22c1c' }}>
              Only letters are allowed: no numbers or special characters
            </p>
          )}
          {form.formState.errors.full_name && !nameSpecialCharWarning && (
            <p className="text-xs pl-1" style={{ color: '#a22c1c' }}>{form.formState.errors.full_name.message}</p>
          )}
        </div>

        {/* Date & Time — expandable boxes */}
        <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 sm:gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          {/* Birth Date */}
          {/* data-af-field groups the collapsed button, the dd/mm/yyyy sub-inputs
              and the sr-only native picker into ONE field, so field_focus reports
              "birth_date" once instead of four unnamed inputs that have to be added
              back together to mean anything. See form-tracking.ts. */}
          <div className="space-y-1.5" data-af-field="birth_date">
            {!dateExpanded ? (
              <button
                type="button"
                onClick={() => setDateExpanded(true)}
                aria-label="Enter birth date"
                className="w-full h-12 rounded-xl border flex items-center gap-2.5 px-3.5 transition-all hover:border-[rgba(26,10,46,0.2)] focus:outline-none focus:ring-2 focus:ring-[#F2C572]/60 focus:border-[#F2C572]/40"
                style={{ background: '#f6f4f2', borderColor: 'rgba(26, 10, 46, 0.12)' }}
              >
                <Calendar className="w-4 h-4 flex-shrink-0" style={{ color: '#a22c1c' }} />
                <span className="text-sm" style={{ color: '#6B5C7A', fontFamily: "'Inter', sans-serif" }}>Enter Birth Date</span>
              </button>
            ) : (
              <div className="flex items-center gap-1 sm:gap-1.5 h-12 rounded-xl border px-2 sm:px-3 overflow-hidden" style={{ background: '#f6f4f2', borderColor: 'rgba(26, 10, 46, 0.12)' }}>
                <button type="button" onClick={() => hiddenDateRef.current?.showPicker?.()} aria-label="Open date picker" className="flex-shrink-0 cursor-pointer rounded focus:outline-none focus:ring-2 focus:ring-[#F2C572]/60">
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: '#a22c1c' }} />
                </button>
                <input
                  ref={hiddenDateRef}
                  type="date"
                  max="9999-12-31"
                  className="sr-only"
                  tabIndex={-1}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      const [y, m, d] = val.split("-");
                      const updated = { dd: d, mm: m, yyyy: y };
                      setDateParts(updated);
                      updateDateValue(updated);
                    }
                  }}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="DD"
                  value={dateParts.dd}
                  autoFocus
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 2);
                    const updated = { ...dateParts, dd: val };
                    setDateParts(updated);
                    updateDateValue(updated);
                    if (val.length === 2) dateMonthRef.current?.focus();
                  }}
                  onBlur={(e) => {
                    const raw = e.target.value;
                    if (!raw) return;
                    let num = parseInt(raw, 10);
                    if (isNaN(num) || num < 1) num = 1;
                    if (num > 31) num = 31;
                    const clamped = String(num).padStart(2, "0");
                    if (clamped !== raw) {
                      const updated = { ...dateParts, dd: clamped };
                      setDateParts(updated);
                      updateDateValue(updated);
                    }
                  }}
                  className="w-6 min-w-0 flex-1 sm:w-8 h-7 sm:h-8 text-center text-xs sm:text-sm rounded-lg border-0 outline-none focus:ring-1 focus:ring-[#F2C572]/50"
                  style={{ background: 'rgba(26, 10, 46, 0.04)', color: '#1A0A2E' }}
                />
                <span style={{ color: '#6B5C7A' }} className="text-xs flex-shrink-0">/</span>
                <input
                  ref={dateMonthRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="MM"
                  value={dateParts.mm}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 2);
                    const updated = { ...dateParts, mm: val };
                    setDateParts(updated);
                    updateDateValue(updated);
                    if (val.length === 2) dateYearRef.current?.focus();
                  }}
                  onBlur={(e) => {
                    const raw = e.target.value;
                    if (!raw) return;
                    let num = parseInt(raw, 10);
                    if (isNaN(num) || num < 1) num = 1;
                    if (num > 12) num = 12;
                    const clamped = String(num).padStart(2, "0");
                    if (clamped !== raw) {
                      const updated = { ...dateParts, mm: clamped };
                      setDateParts(updated);
                      updateDateValue(updated);
                    }
                  }}
                  className="w-6 min-w-0 flex-1 sm:w-8 h-7 sm:h-8 text-center text-xs sm:text-sm rounded-lg border-0 outline-none focus:ring-1 focus:ring-[#F2C572]/50"
                  style={{ background: 'rgba(26, 10, 46, 0.04)', color: '#1A0A2E' }}
                />
                <span style={{ color: '#6B5C7A' }} className="text-xs flex-shrink-0">/</span>
                <input
                  ref={dateYearRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="YYYY"
                  value={dateParts.yyyy}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                    const updated = { ...dateParts, yyyy: val };
                    setDateParts(updated);
                    updateDateValue(updated);
                  }}
                  onBlur={(e) => {
                    const raw = e.target.value;
                    if (!raw || raw.length < 4) return;
                    let num = parseInt(raw, 10);
                    if (isNaN(num) || num < 1900) num = 1900;
                    const currentYear = new Date().getFullYear();
                    if (num > currentYear) num = currentYear;
                    const clamped = String(num);
                    if (clamped !== raw) {
                      const updated = { ...dateParts, yyyy: clamped };
                      setDateParts(updated);
                      updateDateValue(updated);
                    }
                  }}
                  className="w-8 min-w-0 flex-[1.4] sm:w-11 h-7 sm:h-8 text-center text-xs sm:text-sm rounded-lg border-0 outline-none focus:ring-1 focus:ring-[#F2C572]/50"
                  style={{ background: 'rgba(26, 10, 46, 0.04)', color: '#1A0A2E' }}
                />
              </div>
            )}
            {form.formState.errors.birth_date && (
              <p className="text-xs pl-1" style={{ color: '#a22c1c' }}>{form.formState.errors.birth_date.message}</p>
            )}
          </div>

          {/* Birth Time */}
          <div className="space-y-1.5" data-af-field="birth_time">
            {!timeExpanded ? (
              <button
                type="button"
                onClick={() => setTimeExpanded(true)}
                aria-label="Enter birth time"
                className="w-full h-12 rounded-xl border flex items-center gap-2.5 px-3.5 transition-all hover:border-[rgba(26,10,46,0.2)] focus:outline-none focus:ring-2 focus:ring-[#F2C572]/60 focus:border-[#F2C572]/40"
                style={{ background: '#f6f4f2', borderColor: 'rgba(26, 10, 46, 0.12)' }}
              >
                <Clock className="w-4 h-4 flex-shrink-0" style={{ color: '#a22c1c' }} />
                <span className="text-sm" style={{ color: '#6B5C7A', fontFamily: "'Inter', sans-serif" }}>Enter Birth Time</span>
              </button>
            ) : (
              <div className="flex items-center gap-1 sm:gap-1.5 h-12 rounded-xl border px-2 sm:px-3 overflow-hidden" style={{ background: '#f6f4f2', borderColor: 'rgba(26, 10, 46, 0.12)' }}>
                <button type="button" onClick={() => hiddenTimeRef.current?.showPicker?.()} aria-label="Open time picker" className="flex-shrink-0 cursor-pointer rounded focus:outline-none focus:ring-2 focus:ring-[#F2C572]/60">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: '#a22c1c' }} />
                </button>
                <input
                  ref={hiddenTimeRef}
                  type="time"
                  className="sr-only"
                  tabIndex={-1}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      const [h, m] = val.split(":");
                      let hour = parseInt(h, 10);
                      const period = hour >= 12 ? "PM" : "AM";
                      if (hour > 12) hour -= 12;
                      if (hour === 0) hour = 12;
                      const updated = { hh: String(hour), min: m, period };
                      setTimeParts(updated);
                      updateTimeValue(updated);
                    }
                  }}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="HH"
                  value={timeParts.hh}
                  autoFocus
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 2);
                    const updated = { ...timeParts, hh: val };
                    setTimeParts(updated);
                    updateTimeValue(updated);
                    if (val.length === 2) timeMinRef.current?.focus();
                  }}
                  onBlur={(e) => {
                    const raw = e.target.value;
                    if (!raw) return;
                    let num = parseInt(raw, 10);
                    if (isNaN(num) || num < 1) num = 1;
                    if (num > 12) num = 12;
                    const clamped = String(num);
                    if (clamped !== raw) {
                      const updated = { ...timeParts, hh: clamped };
                      setTimeParts(updated);
                      updateTimeValue(updated);
                    }
                  }}
                  className="w-6 min-w-0 flex-1 sm:w-8 h-7 sm:h-8 text-center text-xs sm:text-sm rounded-lg border-0 outline-none focus:ring-1 focus:ring-[#F2C572]/50"
                  style={{ background: 'rgba(26, 10, 46, 0.04)', color: '#1A0A2E' }}
                />
                <span style={{ color: '#6B5C7A' }} className="text-xs flex-shrink-0">:</span>
                <input
                  ref={timeMinRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="MM"
                  value={timeParts.min}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 2);
                    const updated = { ...timeParts, min: val };
                    setTimeParts(updated);
                    updateTimeValue(updated);
                    if (val.length === 2) ampmRef.current?.focus();
                  }}
                  onBlur={(e) => {
                    const raw = e.target.value;
                    if (!raw) return;
                    let num = parseInt(raw, 10);
                    if (isNaN(num) || num < 0) num = 0;
                    if (num > 59) num = 59;
                    const clamped = String(num).padStart(2, "0");
                    if (clamped !== raw) {
                      const updated = { ...timeParts, min: clamped };
                      setTimeParts(updated);
                      updateTimeValue(updated);
                    }
                  }}
                  className="w-6 min-w-0 flex-1 sm:w-8 h-7 sm:h-8 text-center text-xs sm:text-sm rounded-lg border-0 outline-none focus:ring-1 focus:ring-[#F2C572]/50"
                  style={{ background: 'rgba(26, 10, 46, 0.04)', color: '#1A0A2E' }}
                />
                <button
                  ref={ampmRef}
                  type="button"
                  onClick={() => {
                    const newPeriod = timeParts.period === "AM" ? "PM" : "AM";
                    const updated = { ...timeParts, period: newPeriod };
                    setTimeParts(updated);
                    updateTimeValue(updated);
                  }}
                  className="flex-shrink-0 ml-0.5 sm:ml-1 w-8 sm:w-10 h-7 sm:h-8 text-center text-[10px] sm:text-xs font-semibold rounded-lg outline-none focus:ring-1 focus:ring-[#F2C572]/50 transition-colors"
                  style={{ background: 'rgba(162, 44, 28, 0.08)', color: '#a22c1c', border: '1px solid rgba(162, 44, 28, 0.2)' }}
                >
                  {timeParts.period || "AM"}
                </button>
              </div>
            )}
            {form.formState.errors.birth_time && (
              <p className="text-xs pl-1" style={{ color: '#a22c1c' }}>{form.formState.errors.birth_time.message}</p>
            )}
          </div>
        </div>

        {/* Birth Place — LocationSearch already has icon inside */}
        {/* Grouped for the same reason: LocationSearch owns its own input, which
            carries no name or id this file controls. */}
        <div className="space-y-1.5" data-af-field="birth_place">
          <LocationSearch
            value={form.getValues("birth_place")}
            selected={locationSet}
            onTextChange={(text) => {
              // Keep the form in sync with what was typed, but drop any
              // previously selected coordinates — they belong to a different
              // place now (AF-091).
              form.setValue("birth_place", text, { shouldValidate: false });
              setLocationError(null);
              if (locationSet) {
                setLocationSet(false);
                form.setValue("latitude", 0);
                form.setValue("longitude", 0);
              }
            }}
            onChange={(place, lat, lon, tz) => {
              form.setValue("birth_place", place, { shouldValidate: true });
              form.setValue("latitude", parseFloat(lat.toFixed(4)), { shouldValidate: true });
              form.setValue("longitude", parseFloat(lon.toFixed(4)), { shouldValidate: true });
              form.setValue("timezone", tz, { shouldValidate: true });
              setLocationSet(true);
              setLocationError(null);
            }}
          />
          {locationError ? (
            <p className="text-xs pl-1" style={{ color: '#a22c1c' }}>{locationError}</p>
          ) : form.formState.errors.birth_place ? (
            <p className="text-xs pl-1" style={{ color: '#a22c1c' }}>{form.formState.errors.birth_place.message}</p>
          ) : null}
        </div>

        {/* Coordinates — shown after location is picked */}
        {locationSet && (
          <div className="grid grid-cols-3 gap-3 animate-fade-in">
            <div className="space-y-1.5">
              <Label htmlFor="latitude" className="text-[11px] pl-1" style={{ color: '#6B5C7A' }}>Latitude</Label>
              <Input
                id="latitude"
                type="number"
                step="0.0001"
                {...form.register("latitude")}
                className="h-10 text-xs rounded-lg border"
                style={{ background: '#f6f4f2', borderColor: 'rgba(26, 10, 46, 0.12)', color: '#1A0A2E' }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="longitude" className="text-[11px] pl-1" style={{ color: '#6B5C7A' }}>Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="0.0001"
                {...form.register("longitude")}
                className="h-10 text-xs rounded-lg border"
                style={{ background: '#f6f4f2', borderColor: 'rgba(26, 10, 46, 0.12)', color: '#1A0A2E' }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timezone" className="text-[11px] pl-1" style={{ color: '#6B5C7A' }}>Timezone</Label>
              <Input
                id="timezone"
                type="number"
                step="0.5"
                {...form.register("timezone")}
                className="h-10 text-xs rounded-lg border"
                style={{ background: '#f6f4f2', borderColor: 'rgba(26, 10, 46, 0.12)', color: '#1A0A2E' }}
              />
            </div>
          </div>
        )}

        {/* Auth error */}
        {authError && (
          <p className="text-xs rounded-lg px-3 py-2 text-center" style={{ color: '#a22c1c', background: 'rgba(162, 44, 28, 0.06)', border: '1px solid rgba(162, 44, 28, 0.15)' }}>
            {authError}
          </p>
        )}

        {/* Spacer before buttons */}
        <div className="pt-3" />

        {/* Buttons */}
        {showAuth ? (
          <div className="space-y-3 pt-1">
            {/* Primary action — gold gradient CTA */}
            <button
              type="button"
              onClick={() => {
                analytics({ 'gtm.text': 'Signup_Continuewithgoogle' });
                handleGoogle();
              }}
              disabled={googleLoading}
              className="w-full h-12 rounded-2xl text-sm font-semibold flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
              style={{
                backgroundImage: 'linear-gradient(135deg, #F2C572, #FFDFA3)',
                color: '#2A0E4A',
                boxShadow: '0 10px 30px rgba(242,197,114,0.4)',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {googleLoading ? (
                <span className="h-4 w-4 rounded-full border-2 border-[#2A0E4A]/30 border-t-[#2A0E4A] animate-spin" />
              ) : isSignedIn ? (
                <>Continue <ArrowRight className="w-4 h-4" /></>
              ) : (
                <>
                  <GoogleIcon />
                  Continue with Google
                </>
              )}
            </button>

            {/* Skip — removed: Google-only auth */}
          </div>
        ) : (
          <Button
            type="submit"
            onClick={onSubmitClick}
            disabled={loading}
            className={`group w-full gap-2 rounded-2xl font-semibold hover:brightness-105 transition-all ${submitContent ? "min-h-[60px] h-auto py-3.5 px-4 sm:px-6 text-[13px] sm:text-[15px] leading-tight" : "h-12 text-sm"}`}
            style={{ backgroundImage: 'linear-gradient(135deg, #F2C572, #FFDFA3)', color: '#2A0E4A', boxShadow: '0 10px 30px rgba(242,197,114,0.4)' }}
          >
            {loading ? (
              <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : submitContent ? (
              submitContent
            ) : (
              <>Generate Your Financial Kundali</>
            )}
          </Button>
        )}
      </form>
    </div>
  );
}

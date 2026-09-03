import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MessageSquare, Send, Sparkles, X, Moon, TrendingUp, Shield, Coins, Minimize2, Expand } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { sendChatMessage, type ChatMessagePayload } from "@/lib/vedicfinance-api";
import type { ReportRequest } from "@/lib/vedicfinance-types";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { usePaymentStatus } from "@/hooks/usePaymentStatus";
import { useChatAccess } from "@/hooks/useChatAccess";
import { useReportStore } from "@/lib/report-store";
import { useChatStore, CHAT_INIT_ID, type ChatMessage } from "@/lib/chat-store";
import { useAutoResizeTextarea, chatSubmitOnEnter } from "@/hooks/useAutoResizeTextarea";
import analytics from "@/lib/analytics";

/* ── Birth data helper ────────────────────────────────── */
function getBirthData(): ReportRequest | null {
  const raw = sessionStorage.getItem("kundliRequest");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/* ── Quick suggestions ────────────────────────────────── */
const quickSuggestions = [
  { icon: <TrendingUp className="w-3 h-3" />, text: "Best time to invest?" },
  { icon: <Shield className="w-3 h-3" />, text: "My portfolio risk" },
  { icon: <Coins className="w-3 h-3" />, text: "Gold vs mutual funds?" },
];

/* ── Typing dots ──────────────────────────────────────── */
const TypingDots = () => (
  <div className="flex items-center gap-2 px-3 py-2">
    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[hsl(262,75%,50%)] to-[hsl(280,60%,50%)] flex items-center justify-center shrink-0">
      <Moon className="w-3 h-3 text-white" />
    </div>
    <div className="bg-white/[0.05] border border-white/[0.08] px-3 py-2 rounded-xl rounded-bl-sm flex gap-1">
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
      ))}
    </div>
  </div>
);

/* ── Main Floating Widget ─────────────────────────────── */
export default function FloatingAstrologerChat() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { hasPaid } = usePaymentStatus(); // drives the in-widget paywall reply
  const { openChat } = useChatAccess();
  const storeUserName = useReportStore((s) => s.userName);
  const setUserName = useReportStore((s) => s.setUserName);
  const birthDataRef = useRef<ReportRequest | null>(getBirthData());
  const [open, setOpen] = useState(false);
  // Shared with the full-page /ai-chat view so expanding preserves the
  // conversation (AF-090).
  const messages = useChatStore((s) => s.messages);
  const appendMessage = useChatStore((s) => s.appendMessage);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [displayedText, setDisplayedText] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  // minHeight matches the h-7 send button beside it, so the resting single line
  // sits centred in the row rather than pinned to its bottom by `items-end`.
  const { textareaRef: inputRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 28, maxHeight: 80 });

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 60);
  }, []);

  /* Listen for external open trigger (e.g. sidebar button) */
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-astrologer-chat", handler);
    return () => window.removeEventListener("open-astrologer-chat", handler);
  }, []);

  // Fetch birth data from DB if not in sessionStorage
  useEffect(() => {
    if (birthDataRef.current) return;
    if (!user) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("user_birth_details")
          .select("full_name, birth_date, birth_time, birth_place, latitude, longitude, timezone, birth_time_accuracy")
          .eq("id", user.id)
          .single();
        if (data && data.birth_date && data.birth_time) {
          const req: ReportRequest = {
            full_name: data.full_name || "",
            birth_date: data.birth_date,
            birth_time: data.birth_time,
            birth_time_accuracy: data.birth_time_accuracy || "exact",
            birth_place: data.birth_place || "",
            latitude: data.latitude || 0,
            longitude: data.longitude || 0,
            timezone: data.timezone ?? 5.5,
          };
          birthDataRef.current = req;
          sessionStorage.setItem("kundliRequest", JSON.stringify(req));
          // Sync the store's userName if it hasn't been set yet (e.g. fresh tab
          // where the DB-restore in FinancialKundali.tsx hasn't resolved yet).
          if (!storeUserName && req.full_name) {
            setUserName(req.full_name);
          }
        }
      } catch { /* non-critical */ }
    })();
  }, [user]);

  /* letter-by-letter reveal */
  const animateText = useCallback((id: string, fullText: string) => {
    let i = 0;
    const interval = setInterval(() => {
      i += 4;
      setDisplayedText((prev) => ({ ...prev, [id]: fullText.slice(0, i) }));
      if (i >= fullText.length) {
        clearInterval(interval);
        setDisplayedText((prev) => ({ ...prev, [id]: fullText }));
      }
    }, 10);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text: text.trim() };
    appendMessage(userMsg);
    setInput("");
    adjustHeight(true);
    setIsTyping(true);
    scrollToBottom();

    // Stage 1: Check payment first (before checking kundali)
    if (!hasPaid) {
      const payLink = "/payment";
      const errMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "ai",
        text: `🔮 Unlock the AI Astrologer for ₹99 and get unlimited personalized financial astrology insights. [Pay ₹99 to Continue →](${payLink})`,
      };
      appendMessage(errMsg);
      setIsTyping(false);
      animateText(errMsg.id, errMsg.text);
      scrollToBottom();
      return;
    }

    // Stage 2: Payment verified — check if kundali has been generated
    const birthData = birthDataRef.current || getBirthData();
    if (birthData) birthDataRef.current = birthData;
    if (!birthData) {
      const errMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "ai",
        text: "I need your birth details to analyze your chart. Please generate your Financial Kundali first, then come back to chat!",
      };
      appendMessage(errMsg);
      setIsTyping(false);
      animateText(errMsg.id, errMsg.text);
      scrollToBottom();
      return;
    }

    const history: ChatMessagePayload[] = messages
      .filter((m) => m.id !== CHAT_INIT_ID)
      .map((m) => ({
        role: m.role === "ai" ? ("assistant" as const) : ("user" as const),
        content: m.text,
      }));

    try {
      const response = await sendChatMessage({
        birth_date: birthData.birth_date,
        birth_time: birthData.birth_time,
        birth_place: birthData.birth_place,
        latitude: birthData.latitude,
        longitude: birthData.longitude,
        timezone: birthData.timezone,
        birth_time_accuracy: birthData.birth_time_accuracy,
        message: text.trim(),
        history,
      });

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "ai",
        text: response.reply,
      };
      appendMessage(aiMsg);
      animateText(aiMsg.id, response.reply);
    } catch {
      const errMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "ai",
        text: "I'm having trouble connecting right now. Please try again in a moment.",
      };
      appendMessage(errMsg);
      animateText(errMsg.id, errMsg.text);
    } finally {
      setIsTyping(false);
      scrollToBottom();
    }
    // hasPaid must be a dep — without it the callback closed over a stale value
    // and kept showing the paywall reply to a user who had just paid.
  }, [isTyping, scrollToBottom, animateText, messages, appendMessage, adjustHeight, user, hasPaid]);

  useEffect(() => scrollToBottom(), [messages, scrollToBottom]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open, inputRef]);

  const getDisplayText = (msg: ChatMessage) => {
    if (msg.role === "user") return msg.text;
    return displayedText[msg.id] ?? msg.text;
  };

  const hasOnlyInit = messages.length === 1;

  /* Navigate to the dedicated full-page AI chat */
  const openFullChat = useCallback(() => {
    analytics({ 'gtm.text': 'VedicFinance_ChatwithAstrologer' });
    setOpen(false);
    openChat();
  }, [openChat]);

  // Hide the floating widget where it does not belong:
  //   /ai-chat  — the full-page version of this same chat
  //   /admin    — an operator console, not a customer surface. The bubble sat in
  //               the corner of the data tables offering "Chat with AI
  //               Astrologer" to whoever was auditing accounts.
  //   embed     — the chart is being rendered inside someone else's page
  const isEmbed = new URLSearchParams(location.search).get("embed") === "true";
  const HIDDEN_ON = ["/ai-chat", "/admin"];
  if (HIDDEN_ON.includes(location.pathname) || isEmbed) return null;

  return (
    <>
      {/* ── Floating Action Button ── */}
      <button
        onClick={() => {
          // Only track the open transition — the same button also closes.
          if (!open) {
            analytics({ 'gtm.text': 'VedicFinance_Homepage_ChatBot' });
            // Also track if chatbot is opened from homepage (where sample kundali is visible)
            if (location.pathname === "/home" || location.pathname === "/") {
              analytics({ 'gtm.text': 'Samplekundali_Chatbot' });
            }
          }
          setOpen((o) => !o);
        }}
        aria-label={open ? "Close AI Astrologer chat" : "Open AI Astrologer chat"}
        className={cn(
          "fixed bottom-5 right-5 z-[60] h-14 w-14 rounded-full flex items-center justify-center transition-all duration-300",
          "shadow-[0_8px_32px_rgba(242,197,114,0.35)]",
          "hover:scale-110 active:scale-95",
          // The widget is mounted globally, so this button sits over both the
          // white landing/legal pages and the dark Cosmic ones. The old open
          // state (translucent white pill + white glyph) vanished on white, so
          // both states now use the opaque gold pill, which reads on any
          // background — only the glyph swaps.
          "bg-gradient-to-br from-[#F2C572] to-[#FFDFA3] rotate-0",
          // Hide on mobile, show on desktop (sm breakpoint and above)
          "hidden sm:flex"
        )}
      >
        {open ? (
          <X className="w-5 h-5 text-[#2A0E4A]" />
        ) : (
          <span className="text-lg leading-none" role="img" aria-label="crystal ball">🔮</span>
        )}
        {/* Notification dot when closed */}
        {!open && (
          <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-[#2FBF9F] border-2 border-[#2A0E4A] animate-pulse" />
        )}
      </button>

      {/* ── Chat Panel ── */}
      {open && (
        <div
          className={cn(
            "fixed z-[60] flex flex-col overflow-hidden",
            "border border-white/[0.1] bg-[hsl(220,20%,6%)]/95 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)]",
            // Mobile: full-width bottom sheet
            "bottom-0 right-0 left-0 h-[75vh] rounded-t-3xl",
            // Desktop: floating panel
            "sm:bottom-24 sm:right-5 sm:left-auto sm:w-[380px] sm:h-[520px] sm:rounded-2xl",
          )}
          style={{
            animation: "floatChatIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.08] bg-white/[0.02]">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#4B1D73] to-[#A14EBF] flex items-center justify-center ring-1 ring-white/10">
              <Sparkles className="h-4 w-4 text-[#F2C572]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#F5E9FF] tracking-tight">AI Astrologer</p>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2FBF9F] animate-pulse" />
                <p className="text-[10px] text-[#A89BC8]">Vedic wealth advisor • Online</p>
              </div>
            </div>
            <button
              onClick={openFullChat}
              className="h-8 w-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors group"
              aria-label="Open in full window"
              title="Open in full window"
            >
              <Expand className="w-4 h-4 text-white/40 group-hover:text-[#F2C572] transition-colors" />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="h-8 w-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors sm:hidden"
              aria-label="Minimize chat"
            >
              <Minimize2 className="w-4 h-4 text-white/50" />
            </button>
          </div>

          {/* Messages area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scroll-smooth">
            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex gap-2", msg.role === "user" ? "flex-row-reverse" : "")}>
                {msg.role === "ai" && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[hsl(262,75%,50%)] to-[hsl(280,60%,50%)] flex items-center justify-center shrink-0 mt-0.5">
                    <Moon className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                <div className={cn("max-w-[80%] min-w-0", msg.role === "user" ? "ml-auto" : "")}>
                  <div
                    className={cn(
                      "px-3 py-2 text-xs leading-relaxed break-words overflow-wrap-anywhere",
                      msg.role === "user"
                        ? "bg-gradient-to-br from-[#F2C572]/20 to-[#FFDFA3]/10 border border-[#F2C572]/30 rounded-2xl rounded-br-sm text-[#F5E9FF]"
                        : "bg-white/[0.04] border border-white/[0.08] rounded-2xl rounded-bl-sm text-[#D6C6F5]"
                    )}
                    style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
                  >
                    {msg.role === "user" ? (
                      getDisplayText(msg)
                    ) : (
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                          strong: ({ children }) => <strong className="text-[#F2C572] font-semibold">{children}</strong>,
                          a: ({ href, children }) => (
                            <a 
                              href={href} 
                              onClick={(e) => {
                                e.preventDefault();
                                if (href) navigate(href);
                              }}
                              className="text-[#F2C572] underline hover:text-[#FFDFA3] transition-colors cursor-pointer"
                            >
                              {children}
                            </a>
                          ),
                          ul: ({ children }) => <ul className="list-disc list-inside mb-1.5 space-y-0.5">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside mb-1.5 space-y-0.5">{children}</ol>,
                          li: ({ children }) => <li className="text-[#D6C6F5]/85">{children}</li>,
                          h3: ({ children }) => <h3 className="text-xs font-bold text-[#F2C572] mt-1.5 mb-0.5">{children}</h3>,
                          h4: ({ children }) => <h4 className="text-[11px] font-semibold text-[#C8A2FF] mt-1 mb-0.5">{children}</h4>,
                          code: ({ children }) => <code className="bg-white/10 px-1 py-0.5 rounded text-[10px] text-[#2FBF9F]">{children}</code>,
                        }}
                      >
                        {getDisplayText(msg)}
                      </ReactMarkdown>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isTyping && <TypingDots />}
          </div>

          {/* Quick suggestions — only when no user messages yet */}
          {hasOnlyInit && !isTyping && (
            <div className="px-3 pb-1 flex gap-1.5 overflow-x-auto scrollbar-hide">
              {quickSuggestions.map((s) => (
                <button
                  key={s.text}
                  onClick={() => sendMessage(s.text)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-[10px] text-[#C8A2FF] hover:bg-white/[0.06] hover:border-[#F2C572]/30 hover:text-[#F2C572] transition-all"
                >
                  {s.icon}
                  <span>{s.text}</span>
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 py-2.5 border-t border-white/[0.08] bg-white/[0.02]">
            <form
              onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
              className="flex items-end gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 focus-within:border-[#F2C572]/30 transition-colors"
            >
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => { setInput(e.target.value); adjustHeight(); }}
                onKeyDown={chatSubmitOnEnter(() => sendMessage(input))}
                placeholder="Ask about your wealth timing..."
                className="flex-1 min-w-0 bg-transparent text-xs text-[#F5E9FF] placeholder:text-[#A89BC8]/60 outline-none resize-none leading-5 py-1"
                style={{ overflowY: "auto" }}
                disabled={isTyping}
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className={cn(
                  "h-7 w-7 shrink-0 rounded-lg flex items-center justify-center transition-all",
                  input.trim() && !isTyping
                    ? "bg-gradient-to-br from-[#F2C572] to-[#FFDFA3] text-[#2A0E4A] shadow-[0_4px_12px_rgba(242,197,114,0.3)] hover:shadow-[0_4px_16px_rgba(242,197,114,0.5)]"
                    : "bg-white/[0.06] text-white/20 cursor-not-allowed"
                )}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

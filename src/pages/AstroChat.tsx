import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Sparkles, Star, TrendingUp, Shield, Moon, ArrowUpIcon, Paperclip, Coins, BarChart3, Landmark, Gem, Clock, Globe, SquarePen, Briefcase, Zap, Activity } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { sendChatMessage, type ChatMessagePayload } from "@/lib/vedicfinance-api";
import type { ReportRequest } from "@/lib/vedicfinance-types";
import astrologerImg from "@/assets/astrologer.webp";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useKundaliTheme } from "@/lib/kundali-theme-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useChatStore, hasStartedChat, CHAT_INIT_ID, type ChatMessage } from "@/lib/chat-store";
import { useAutoResizeTextarea, chatSubmitOnEnter } from "@/hooks/useAutoResizeTextarea";
import { usePaymentStatus } from "@/hooks/usePaymentStatus";

/* ── Quick action pill ───────────────────────────────── */
interface QuickActionProps { icon: React.ReactNode; label: string; onClick: () => void; isVedic?: boolean; }
function QuickAction({ icon, label, onClick, isVedic }: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-full border transition-all text-xs backdrop-blur-sm",
        isVedic
          ? "border-[rgba(184,134,11,0.15)] bg-[rgba(255,252,245,0.7)] text-[#503214] hover:text-[#2C1810] hover:bg-[rgba(255,249,236,0.9)] hover:border-[rgba(184,134,11,0.3)]"
          : "border-white/10 bg-white/[0.04] text-white/60 hover:text-white hover:bg-white/[0.08] hover:border-white/20"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/* ── Welcome / empty state ───────────────────────────── */
const quickActions = [
  { icon: <TrendingUp className="w-3.5 h-3.5" />, label: "Best time to invest?" },
  { icon: <BarChart3 className="w-3.5 h-3.5" />, label: "My wealth yoga analysis" },
  { icon: <Shield className="w-3.5 h-3.5" />, label: "Portfolio risk from Kundali" },
  { icon: <Coins className="w-3.5 h-3.5" />, label: "Gold vs mutual funds?" },
  { icon: <Landmark className="w-3.5 h-3.5" />, label: "SIP strategy for my chart" },
  { icon: <Clock className="w-3.5 h-3.5" />, label: "Current Dasha & income" },
  { icon: <Gem className="w-3.5 h-3.5" />, label: "Luxury asset timing" },
  { icon: <Globe className="w-3.5 h-3.5" />, label: "Foreign income prospects" },
];

interface ChatWelcomeProps {
  onSend: (text: string) => void;
  initialValue?: string;
}
function ChatWelcome({ onSend, initialValue = "" }: ChatWelcomeProps) {
  const [message, setMessage] = useState(initialValue);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 52, maxHeight: 160 });
  const { theme, colors } = useKundaliTheme();
  const isVedic = theme === "vedic";

  const handleSend = () => {
    if (!message.trim()) return;
    onSend(message.trim());
  };

  return (
    <div className="w-full flex flex-col items-center justify-center px-6 py-12 relative h-full">
      {/* Glow orb */}
      {!isVedic && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(245 58% 61% / 0.08) 0%, hsl(43 72% 52% / 0.04) 50%, transparent 70%)", filter: "blur(40px)" }}
        />
      )}
      {isVedic && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(184,134,11,0.06) 0%, rgba(212,160,18,0.03) 50%, transparent 70%)", filter: "blur(40px)" }}
        />
      )}

      {/* Title */}
      <div className="relative z-10 text-center mb-10">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center ring-1"
            style={{
              background: isVedic
                ? "linear-gradient(135deg, #B8860B, #D4A012)"
                : "linear-gradient(135deg, hsl(245,58%,50%), hsl(280,60%,50%))",
              ringColor: isVedic ? "rgba(184,134,11,0.2)" : "rgba(255,255,255,0.1)",
            }}
          >
            <Moon className="w-4.5 h-4.5 text-white" />
          </div>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2" style={{ color: colors.textPrimary }}>
          Financial Astrologer AI
        </h1>
        <p className="text-sm max-w-sm mx-auto leading-relaxed" style={{ color: colors.textSecondary }}>
          Chat with an AI astrologer with deep financial domain knowledge: dashas, transits, and financial timings.
        </p>
      </div>

      {/* Input box */}
      <div className="relative z-10 w-full max-w-3xl">
        <div className={cn(
          "relative rounded-2xl border overflow-hidden transition-colors",
          isVedic
            ? "border-[rgba(184,134,11,0.15)] bg-[rgba(255,253,247,0.8)] backdrop-blur-xl focus-within:border-[rgba(184,134,11,0.35)]"
            : "border-white/[0.1] bg-white/[0.04] backdrop-blur-xl focus-within:border-white/20"
        )}
          style={{ boxShadow: isVedic
            ? "0 0 40px rgba(184,134,11,0.06), inset 0 1px 0 rgba(255,253,247,0.8)"
            : "0 0 40px hsl(245 58% 61% / 0.06), inset 0 1px 0 rgba(255,255,255,0.05)"
          }}
        >
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => { setMessage(e.target.value); adjustHeight(); }}
            onKeyDown={chatSubmitOnEnter(handleSend)}
            placeholder="Ask about your financial astrology..."
            className={cn(
              "w-full px-5 py-4 resize-none border-none bg-transparent text-sm",
              "focus-visible:ring-0 focus-visible:ring-offset-0",
              "min-h-[52px]",
              isVedic
                ? "text-[#2C1810] placeholder:text-[rgba(80,50,20,0.35)]"
                : "text-white placeholder:text-white/25"
            )}
            style={{ overflowY: "auto" }}
          />
          <div className="flex items-center justify-between px-4 pb-3">
            <button className="transition-colors p-1" style={{ color: isVedic ? "rgba(80,50,20,0.4)" : "rgba(255,255,255,0.3)" }}>
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              onClick={handleSend}
              disabled={!message.trim()}
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-lg transition-all",
                message.trim()
                  ? isVedic
                    ? "bg-gradient-to-r from-[#B8860B] to-[#D4A012] text-white hover:opacity-90"
                    : "bg-gradient-to-r from-[hsl(245,58%,55%)] to-[hsl(280,60%,55%)] text-white hover:opacity-90"
                  : isVedic
                    ? "bg-[rgba(184,134,11,0.08)] text-[rgba(80,50,20,0.25)] cursor-not-allowed"
                    : "bg-white/[0.06] text-white/20 cursor-not-allowed",
              )}
            >
              <ArrowUpIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap justify-center gap-2 mt-5">
          {quickActions.map((a) => (
            <QuickAction key={a.label} icon={a.icon} label={a.label} onClick={() => onSend(a.label)} isVedic={isVedic} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Types ───────────────────────────────────────────── */
/* ── Typing indicator ────────────────────────────────── */
const TypingDots = () => (
  <div className="flex items-center gap-3 px-4 py-3">
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[hsl(245,58%,50%)] to-[hsl(280,60%,50%)] flex items-center justify-center shrink-0">
      <Moon className="w-4 h-4 text-white" />
    </div>
    <div className="glass-card px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-2 h-2 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
      ))}
    </div>
  </div>
);

const sidebarQuestions = [
  { text: "What does my chart say about wealth?", icon: Star, category: "Investment" },
  { text: "Is this a good time to invest?", icon: TrendingUp, category: "Investment" },
  { text: "Best SIP strategy for my chart", icon: Sparkles, category: "Investment" },
  { text: "Portfolio risk based on my Kundali", icon: Shield, category: "Risk & Insurance" },
  { text: "Should I buy gold or mutual funds?", icon: Shield, category: "Investment" },
  { text: "What does my current Dasha mean for income?", icon: TrendingUp, category: "Investment" },
  { text: "What insurance does my chart suggest?", icon: Shield, category: "Risk & Insurance" },
  { text: "How to protect wealth based on my chart?", icon: Shield, category: "Risk & Insurance" },
  { text: "Is this a good time for business expansion?", icon: TrendingUp, category: "Business Advisory" },
  { text: "Should I make a large capital investment now?", icon: BarChart3, category: "Business Advisory" },
  { text: "Is the timing right for buying or selling assets?", icon: Zap, category: "Business Advisory" },
  { text: "How should I manage my cash flow this period?", icon: Activity, category: "Business Advisory" },
];

function getBirthData(): ReportRequest | null {
  const raw = sessionStorage.getItem("kundliRequest");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/* ── Main Component ──────────────────────────────────── */
export default function AstroChat({ initialMessage }: { initialMessage?: string }) {
  const navigate = useNavigate();
  const { theme, colors } = useKundaliTheme();
  const isVedic = theme === "vedic";
  const { user } = useAuth();
  const { hasPaid } = usePaymentStatus();
  const birthDataRef = useRef<ReportRequest | null>(getBirthData());

  // On mount, if sessionStorage has no birth data, try fetching from DB
  useEffect(() => {
    if (birthDataRef.current) return; // already have it
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
          // Cache in sessionStorage for subsequent calls
          sessionStorage.setItem("kundliRequest", JSON.stringify(req));
        }
      } catch { /* non-critical */ }
    })();
  }, [user]);
  // Shared with the floating widget so expanding it keeps the conversation
  // (AF-090). `hasStarted` is derived, not stored, so a restored conversation
  // opens in the chat view rather than the welcome screen.
  const messages = useChatStore((s) => s.messages);
  const appendMessage = useChatStore((s) => s.appendMessage);
  const resetMessages = useChatStore((s) => s.reset);
  const hasStarted = hasStartedChat(messages);
  const [input, setInput] = useState(initialMessage || "");
  const [isTyping, setIsTyping] = useState(false);
  const [displayedText, setDisplayedText] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("Investment");
  const scrollRef = useRef<HTMLDivElement>(null);
  // minHeight matches the h-8 send button beside it, so the resting single line
  // sits centred in the row rather than pinned to its bottom by `items-end`.
  const { textareaRef: chatBarRef, adjustHeight: adjustChatBar } = useAutoResizeTextarea({ minHeight: 32, maxHeight: 96 });

  const resetChat = useCallback(() => {
    resetMessages();
    setInput("");
    setDisplayedText({});
    setError(null);
    setActiveCategory("Investment");
    adjustChatBar(true);
  }, [resetMessages, adjustChatBar]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
  }, []);

  /* letter-by-letter reveal */
  const animateText = useCallback((id: string, fullText: string) => {
    let i = 0;
    const interval = setInterval(() => {
      i += 3;
      setDisplayedText((prev) => ({ ...prev, [id]: fullText.slice(0, i) }));
      if (i >= fullText.length) {
        clearInterval(interval);
        setDisplayedText((prev) => ({ ...prev, [id]: fullText }));
      }
    }, 12);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isTyping) return;
    setError(null);

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text: text.trim() };
    appendMessage(userMsg);
    setInput("");
    adjustChatBar(true);
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
    if (birthData) birthDataRef.current = birthData; // cache for next call
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

    // Build history for context
    const history: ChatMessagePayload[] = messages
      .filter((m) => m.id !== CHAT_INIT_ID)
      .map((m) => ({
        role: m.role === "ai" ? "assistant" as const : "user" as const,
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
    } catch (err: any) {
      setError(err.message || "Failed to get response");
      const errMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "ai",
        text: "I'm having trouble connecting right now. Please check that the Supabase edge functions are deployed and the OpenAI API key is configured.",
      };
      appendMessage(errMsg);
      animateText(errMsg.id, errMsg.text);
    } finally {
      setIsTyping(false);
      scrollToBottom();
    }
  }, [isTyping, scrollToBottom, animateText, messages, appendMessage, adjustChatBar, user, hasPaid]);

  useEffect(() => scrollToBottom(), [messages, scrollToBottom]);

  const getDisplayText = (msg: ChatMessage) => {
    if (msg.role === "user") return msg.text;
    return displayedText[msg.id] ?? msg.text;
  };

  return (
    <div className={`flex-1 flex overflow-hidden ${!hasStarted ? "w-full h-full" : "flex-col lg:flex-row"}`}>
      {/* ── Sidebar (left) — hidden until chat has started ── */}
      <div className={`w-full lg:w-[320px] shrink-0 overflow-hidden lg:overflow-y-auto border-b lg:border-b-0 lg:border-r lg:max-h-none ${!hasStarted ? "hidden" : ""}`}
        style={{ borderColor: isVedic ? "rgba(184,134,11,0.1)" : "rgba(255,255,255,0.06)" }}
      >
        <div className="relative h-20 lg:h-28 overflow-hidden hidden lg:block">
          <img
            src={astrologerImg}
            alt="Vedic Astrologer"
            className="w-full h-full object-cover"
          loading="lazy" decoding="async" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
          <div className="absolute bottom-3 left-4">
            <p className="text-[10px] uppercase tracking-widest text-primary/80 font-semibold">Vedic Financial Advisor</p>
          </div>
        </div>
        <div className="p-3 lg:p-5 space-y-4">
          <div className="text-center hidden lg:block">
            <h3 className="text-sm font-bold tracking-tight mb-1">Ask Your Astrologer</h3>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Powered by your birth chart</p>
          </div>

          {/* Category pills */}
          <div className="hidden lg:flex justify-center gap-3">
            {[
              { label: "Investment", icon: TrendingUp, color: "from-teal-500 to-cyan-400" },
              { label: "Risk & Insurance", icon: Shield, color: "from-orange-500 to-amber-400" },
              { label: "Business Advisory", icon: Briefcase, color: "from-violet-500 to-purple-400" },
            ].map((cat) => (
              <button
                key={cat.label}
                onClick={() => setActiveCategory(cat.label)}
                className={`flex flex-col items-center gap-2 px-4 py-3 rounded-xl transition-all ${
                  activeCategory === cat.label
                    ? "bg-white/[0.06] border border-white/[0.12] ring-1 ring-primary/20"
                    : "hover:bg-white/[0.03] border border-transparent"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center`}>
                  <cat.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] text-center text-muted-foreground whitespace-pre-line leading-tight">{cat.label.replace(" & ", " &\n")}</span>
              </button>
            ))}
          </div>

          {/* Question cards — filtered by active category */}
          <div className="flex lg:flex-col gap-2.5 pt-2 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 scrollbar-hide">
            {sidebarQuestions.filter(q => q.category === activeCategory).map((q, i) => (
              <button
                key={i}
                onClick={() => { setInput(q.text); sendMessage(q.text); }}
                className={cn(
                  "shrink-0 lg:shrink lg:w-full group flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all text-left whitespace-nowrap lg:whitespace-normal",
                  isVedic
                    ? "bg-[rgba(255,252,245,0.6)] border-[rgba(184,134,11,0.1)] hover:bg-[rgba(255,249,236,0.9)] hover:border-[rgba(184,134,11,0.25)]"
                    : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06] hover:border-primary/20"
                )}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <q.icon className="w-4 h-4 shrink-0" style={{ color: isVedic ? "rgba(139,105,20,0.6)" : undefined }} />
                <span className="text-xs" style={{ color: isVedic ? "#503214" : undefined }}>{q.text}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Chat Panel (right) ── */}
      <div className={`flex flex-col min-h-0 ${!hasStarted ? "w-full h-full" : "flex-1 max-w-4xl"}`}>
        {/* Header — only shown after chat starts */}
        <div className={`relative flex items-center gap-3 px-5 py-3 border-b overflow-hidden ${!hasStarted ? "hidden" : ""}`}
          style={{
            borderColor: isVedic ? "rgba(184,134,11,0.1)" : "rgba(255,255,255,0.06)",
            background: isVedic ? "linear-gradient(135deg, #FFFDF7 0%, #FFF9EC 100%)" : undefined,
          }}
        >
          {!isVedic && (
            <div className="absolute inset-0 pointer-events-none">
              <img
                src="https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=800&q=80&fm=webp"
                alt="Planets in space"
                className="w-full h-full object-cover opacity-[0.08]"
              loading="lazy" decoding="async" />
              <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-background/60" />
            </div>
          )}
          <div className={cn("relative z-10 w-8 h-8 rounded-xl flex items-center justify-center", !isVedic && "bg-primary/10 border border-primary/20")}
            style={{
              background: isVedic ? "rgba(184,134,11,0.08)" : undefined,
              border: isVedic ? "1px solid rgba(184,134,11,0.18)" : undefined,
            }}
          >
            <Sparkles className={cn("w-4 h-4", !isVedic && "text-primary")} style={{ color: isVedic ? "#B8860B" : undefined }} />
          </div>
          <div className="relative z-10">
            <h2 className="text-lg md:text-xl font-bold tracking-tight" style={{ color: isVedic ? "#2C1810" : undefined }}>Vedic Financial AI</h2>
            <p className={cn("text-[10px]", !isVedic && "text-muted-foreground")} style={{ color: isVedic ? "rgba(80,50,20,0.6)" : undefined }}>Powered by real chart calculations and AI</p>
          </div>
          <span className={cn("relative z-10 ml-auto h-2 w-2 rounded-full animate-pulse", !isVedic && "bg-secondary")} style={{ background: isVedic ? "#6B8E23" : undefined }} />
          <button
            onClick={resetChat}
            className={cn(
              "relative z-10 ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-xs",
              isVedic
                ? "border-[rgba(184,134,11,0.15)] bg-[rgba(255,252,245,0.6)] text-[#503214] hover:text-[#2C1810] hover:bg-[rgba(255,249,236,0.9)] hover:border-[rgba(184,134,11,0.3)]"
                : "border-white/10 bg-white/[0.04] text-white/50 hover:text-white hover:bg-white/[0.08] hover:border-white/20"
            )}
          >
            <SquarePen className="w-3.5 h-3.5" />
            New Chat
          </button>
        </div>

        {/* Welcome state OR messages */}
        {!hasStarted ? (
          <ChatWelcome onSend={sendMessage} initialValue={initialMessage} />
        ) : (
          <>
            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth" style={{
              background: isVedic
                ? "radial-gradient(ellipse at 50% 50%, rgba(198,147,10,0.03) 0%, transparent 60%), radial-gradient(ellipse at 0% 0%, rgba(212,160,18,0.05) 0%, transparent 40%), radial-gradient(ellipse at 100% 100%, rgba(198,147,10,0.04) 0%, transparent 40%), linear-gradient(180deg, #FFFDF7 0%, #FFF9EC 30%, #FFFCF5 60%, #FFF8E8 100%)"
                : "rgba(23, 23, 23, 0.45)"
            }}>
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 animate-fade-in min-w-0 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  {msg.role === "ai" && (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ring-2"
                      style={{
                        background: isVedic
                          ? "linear-gradient(135deg, #B8860B, #D4A012)"
                          : "linear-gradient(135deg, hsl(245,58%,50%), hsl(280,60%,50%))",
                        ringColor: isVedic ? "rgba(184,134,11,0.2)" : "hsl(245,58%,40%/0.3)",
                      }}
                    >
                      <Moon className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className={`max-w-[75%] ${msg.role === "user" ? "ml-auto" : ""}`}>
                    <div
                      className={cn(
                        "px-4 py-3 text-[13px] leading-relaxed rounded-2xl break-words overflow-hidden",
                        msg.role === "user"
                          ? isVedic
                            ? "bg-[rgba(184,134,11,0.08)] border border-[rgba(184,134,11,0.2)] rounded-br-sm text-[#2C1810]"
                            : "bg-primary/20 border border-primary/30 rounded-br-sm text-foreground"
                          : isVedic
                            ? "bg-[rgba(255,253,247,0.9)] border border-[rgba(184,134,11,0.12)] backdrop-blur-md rounded-bl-sm text-[#503214]"
                            : "bg-white/[0.04] border border-white/[0.08] backdrop-blur-md rounded-bl-sm text-foreground/90"
                      )}
                      style={msg.role === "ai" ? { boxShadow: isVedic ? "0 0 20px rgba(184,134,11,0.06)" : "0 0 20px hsl(245 58% 61% / 0.08)" } : undefined}
                    >
                      {msg.role === "user" ? (
                        getDisplayText(msg)
                      ) : (
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0" style={{ color: isVedic ? "#503214" : undefined }}>{children}</p>,
                            strong: ({ children }) => <strong className="font-semibold" style={{ color: isVedic ? "#8B6914" : undefined }}>{children}</strong>,
                            ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                            li: ({ children }) => <li style={{ color: isVedic ? "#503214" : undefined }}>{children}</li>,
                            h3: ({ children }) => <h3 className="text-sm font-bold mt-2 mb-1" style={{ color: isVedic ? "#2C1810" : undefined }}>{children}</h3>,
                            h4: ({ children }) => <h4 className="text-xs font-semibold mt-1.5 mb-1" style={{ color: isVedic ? "#5A4510" : undefined }}>{children}</h4>,
                            code: ({ children }) => <code className={cn("px-1.5 py-0.5 rounded text-[11px]", isVedic ? "bg-[rgba(184,134,11,0.08)] text-[#5A4510]" : "bg-white/10 text-secondary")}>{children}</code>,
                            a: ({ href, children }) => (
                              <a 
                                href={href} 
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (href) navigate(href);
                                }}
                                className="font-medium underline underline-offset-2 transition-colors cursor-pointer" 
                                style={{ color: isVedic ? "#B8860B" : "#F2C572" }}
                              >
                                {children}
                              </a>
                            ),
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

            {/* Error banner */}
            {error && (
              <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 text-red-400 text-xs">
                {error}
              </div>
            )}

            {/* Input */}
            <div className="px-4 py-3 border-t" style={{ borderColor: isVedic ? "rgba(184,134,11,0.1)" : "rgba(255,255,255,0.06)" }}>
              <form
                onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
                className={cn(
                  "flex items-end gap-2 rounded-xl px-4 py-2.5 backdrop-blur-md transition-colors",
                  isVedic
                    ? "bg-[rgba(255,253,247,0.8)] border border-[rgba(184,134,11,0.15)] focus-within:border-[rgba(184,134,11,0.35)]"
                    : "bg-white/[0.04] border border-white/[0.08] focus-within:border-primary/30"
                )}
              >
                <textarea
                  ref={chatBarRef}
                  rows={1}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); adjustChatBar(); }}
                  onKeyDown={chatSubmitOnEnter(() => sendMessage(input))}
                  placeholder="Ask about your financial astrology..."
                  className={cn(
                    "flex-1 min-w-0 bg-transparent text-sm outline-none resize-none leading-5 py-1.5",
                    isVedic
                      ? "text-[#2C1810] placeholder:text-[rgba(80,50,20,0.35)]"
                      : "text-foreground placeholder:text-muted-foreground"
                  )}
                  style={{ overflowY: "auto" }}
                  disabled={isTyping}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className={cn(
                    "h-8 w-8 shrink-0 rounded-lg flex items-center justify-center disabled:opacity-30 hover:opacity-90 transition-opacity",
                    isVedic
                      ? "bg-gradient-to-r from-[#B8860B] to-[#D4A012] text-white"
                      : "bg-gradient-to-r from-primary to-secondary text-primary-foreground"
                  )}
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { useLocation } from "react-router-dom";
import AstroChat from "./AstroChat";
import { Starfield } from "@/components/ui/starfield-1";

export default function ChatPage() {
  const location = useLocation();
  const initialMessage = (location.state as any)?.initialMessage || "";

  return (
    <div className="h-screen relative overflow-hidden flex flex-col bg-black" style={{ background: "radial-gradient(ellipse at 60% 40%, rgba(88,60,180,0.07) 0%, rgba(30,20,60,0.12) 40%, rgba(0,0,0,1) 75%)" }}>
      <Starfield
        starColor="rgba(255,255,255,0.8)"
        bgColor="rgba(0,0,0,1)"
        speed={0.5}
        quantity={400}
        mouseAdjust
      />
      <div className="relative z-10 flex-1 flex flex-col min-h-0">
        <AstroChat initialMessage={initialMessage} />
      </div>
    </div>
  );
}

import { useEffect, useRef } from "react";

const StarField = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Create shooting stars periodically
    const shoot = () => {
      const star = document.createElement("div");
      star.className = "shooting-star";
      star.style.top = `${Math.random() * 60}%`;
      star.style.left = `${Math.random() * 60}%`;
      star.style.animation = `shoot ${1.2 + Math.random() * 1.5}s linear forwards`;
      container.appendChild(star);
      setTimeout(() => star.remove(), 3000);
    };

    const interval = setInterval(shoot, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div className="starfield" />
      <div className="starfield-twinkle" ref={containerRef} />
      <div className="nebula-bg fixed inset-0 z-0 pointer-events-none" />
    </>
  );
};

export default StarField;

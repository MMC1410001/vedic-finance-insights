import { useMemo } from "react";

interface MeteorShowerProps {
  count?: number;
}

const MeteorShower = ({ count = 12 }: MeteorShowerProps) => {
  const meteors = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const left = Math.random() * 100;
      const top = Math.random() * 40 - 10;
      const delay = Math.random() * 8;
      const duration = 1.5 + Math.random() * 2;
      const size = 1 + Math.random() * 1.5;
      return { id: i, left, top, delay, duration, size };
    });
  }, [count]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {meteors.map((m) => (
        <div
          key={m.id}
          className="absolute rounded-full"
          style={{
            left: `${m.left}%`,
            top: `${m.top}%`,
            width: `${80 + m.size * 40}px`,
            height: `${m.size}px`,
            background: "linear-gradient(90deg, rgba(242,197,114,0.9), rgba(242,197,114,0.4) 30%, transparent)",
            boxShadow: "0 0 6px rgba(242,197,114,0.5), 0 0 12px rgba(242,197,114,0.2)",
            animation: `meteor-fall ${m.duration}s ease-in ${m.delay}s infinite`,
            opacity: 0,
          }}
        />
      ))}
    </div>
  );
};

export default MeteorShower;

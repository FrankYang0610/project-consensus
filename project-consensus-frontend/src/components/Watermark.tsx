export default function Watermark() {
  const year = new Date().getFullYear();
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed bottom-3 left-20 z-30 select-none text-[12px] text-foreground/40"
    >
      © {year} Project Consensus
    </div>
  );
}



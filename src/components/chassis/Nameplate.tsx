export function Nameplate() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 3,
        padding: "6px 12px",
        background: "#8E876F",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.26), inset 0 -1px 0 rgba(0,0,0,0.30), 2px 2px 0 var(--seam)",
      }}
    >
      <span className="nomen nomen--plate">Chernobyl Monitor &middot; Unit 1</span>
      <span className="nomen nomen--sub">
        Process Computer Console &middot; Panel 4C&#8209;117 &middot; Rev D
        03&#8209;74
      </span>
    </div>
  );
}

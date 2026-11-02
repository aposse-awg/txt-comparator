import { COLORS } from "./theme";

export function Badge({ color, children }) {
  return (
    <span style={{
      background: color + "22",
      color,
      border: `1px solid ${color}44`,
      borderRadius: 6,
      padding: "2px 10px",
      fontSize: 12,
      fontWeight: 700,
    }}>
      {children}
    </span>
  );
}

export function StatBox({ label, value, color }) {
  return (
    <div style={{
      background: COLORS.card,
      border: `1px solid ${color}44`,
      borderRadius: 10,
      padding: "14px 20px",
      textAlign: "center",
      flex: 1,
      minWidth: 100,
    }}>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>{label}</div>
    </div>
  );
}

export function EntryList({ entries, color, filter }) {
  const filtered = filter
    ? entries.filter(e => e.includes(filter.toLowerCase()))
    : entries;

  if (!filtered.length) return (
    <div style={{ color: COLORS.muted, fontSize: 13, padding: "12px 0" }}>
      {entries.length === 0 ? "✓ Sin diferencias" : "Sin resultados para ese filtro"}
    </div>
  );

  return (
    <div style={{ maxHeight: 320, overflowY: "auto", marginTop: 8 }}>
      {filtered.map((e, i) => (
        <div key={i} style={{
          fontFamily: "monospace",
          fontSize: 12,
          padding: "5px 10px",
          borderRadius: 5,
          marginBottom: 3,
          background: color + "11",
          borderLeft: `3px solid ${color}`,
          color: COLORS.text,
          wordBreak: "break-all",
        }}>
          {e}
        </div>
      ))}
    </div>
  );
}

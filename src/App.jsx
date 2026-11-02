import { useState, useMemo } from "react";
import { COLORS } from "./theme";
import { Badge, StatBox, EntryList } from "./components";
import { parseAdsTxt, getDomain } from "./adstxt";
import MultiSite from "./MultiSite";

export default function App() {
  const [mode, setMode] = useState("single");
  const [textA, setTextA] = useState("");
  const [textB, setTextB] = useState("");
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState("diff");
  const [compared, setCompared] = useState(false);

  const result = useMemo(() => {
    if (!compared) return null;
    const a = parseAdsTxt(textA);
    const b = parseAdsTxt(textB);

    const onlyInA = [...a.entries].filter(e => !b.entries.has(e)).sort();
    const onlyInB = [...b.entries].filter(e => !a.entries.has(e)).sort();
    const common = [...a.entries].filter(e => b.entries.has(e));

    const domainsA = new Set([...a.entries].map(getDomain));
    const domainsB = new Set([...b.entries].map(getDomain));

    return { a, b, onlyInA, onlyInB, common, domainsA, domainsB };
  }, [compared, textA, textB]);

  const domains = useMemo(() => {
    if (!result) return [];
    const all = new Set([...result.domainsA, ...result.domainsB]);
    return [...all].sort();
  }, [result]);

  const handleCompare = () => setCompared(true);
  const handleReset = () => {
    setCompared(false);
    setTextA("");
    setTextB("");
    setFilter("");
  };

  const exportResult = () => {
    if (!result) return;
    const lines = [
      "=== ADS.TXT COMPARACIÓN ===",
      "",
      `Total A: ${result.a.entries.size} | Total B: ${result.b.entries.size}`,
      `Ya cargadas: ${result.common.length}`,
      `Faltan en el seller: ${result.onlyInA.length}`,
      "",
      "--- FALTAN EN EL SELLER ---",
      ...result.onlyInA,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "adstxt_diff.txt";
    a.click();
  };

  const TABS = [
    { id: "diff", label: "Diferencias" },
    { id: "dupes", label: "Duplicados" },
    { id: "directives", label: "Directivas" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: COLORS.bg,
      color: COLORS.text,
      fontFamily: "system-ui, sans-serif",
      padding: "24px 16px",
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "#fff" }}>
            📄 Ads.txt Validator
          </h1>
          <div style={{ display: "flex", gap: 4, marginTop: 12 }}>
            {[["single", "Un seller"], ["multi", "Múltiples sitios"]].map(([id, label]) => (
              <button key={id} onClick={() => setMode(id)} style={{
                background: mode === id ? COLORS.accent : COLORS.card,
                border: `1px solid ${mode === id ? COLORS.accent : COLORS.border}`,
                color: mode === id ? "#fff" : COLORS.muted,
                borderRadius: 8,
                padding: "6px 16px",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}>
                {label}
              </button>
            ))}
          </div>
          <p style={{ margin: "10px 0 0", color: COLORS.muted, fontSize: 14 }}>
            {mode === "single" ? (
              <>En <b>A</b> pegá tus líneas de demanda. En <b>B</b> pegá el ads.txt completo del seller. Detectamos cuáles de tus líneas faltan en el archivo del seller.</>
            ) : (
              <>En <b>A</b> pegá tus líneas de demanda. En <b>B</b> pegá la lista de sitios. Bajamos el ads.txt y/o app-ads.txt de cada sitio y te mostramos qué líneas faltan y dónde.</>
            )}
          </p>
        </div>

        {/* Hidden instead of unmounted so switching modes keeps each one's state */}
        <div style={{ display: mode === "multi" ? "block" : "none" }}>
          <MultiSite />
        </div>

        {mode === "single" && <>
        {/* Input panels */}
        {!compared && (
          <>
            <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
              {[
                ["A", textA, setTextA, "Tus líneas de demanda", "Pegá acá SOLO las líneas que el seller debería tener (las tuyas)..."],
                ["B", textB, setTextB, "ads.txt del seller", "Pegá acá el archivo ads.txt COMPLETO del seller..."],
              ].map(([label, val, setter, title, ph]) => (
                <div key={label} style={{ flex: 1, minWidth: 280 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "baseline" }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>
                      Archivo {label} · <span style={{ color: COLORS.accent }}>{title}</span>
                    </span>
                    <span style={{ color: COLORS.muted, fontSize: 12 }}>
                      {val.split("\n").filter(l => l.trim() && !l.trim().startsWith("#")).length} líneas
                    </span>
                  </div>
                  <textarea
                    value={val}
                    onChange={e => setter(e.target.value)}
                    placeholder={ph}
                    style={{
                      width: "100%",
                      height: 280,
                      background: COLORS.card,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 10,
                      color: COLORS.text,
                      fontFamily: "monospace",
                      fontSize: 12,
                      padding: 12,
                      resize: "vertical",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              ))}
            </div>
            <button
              onClick={handleCompare}
              disabled={!textA.trim() || !textB.trim()}
              style={{
                background: COLORS.accent,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 28px",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                opacity: (!textA.trim() || !textB.trim()) ? 0.5 : 1,
              }}
            >
              Comparar →
            </button>
          </>
        )}

        {/* Results */}
        {compared && result && (
          <>
            {/* Stats */}
            <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
              <StatBox label="Tus líneas (A)" value={result.a.entries.size} color={COLORS.blue} />
              <StatBox label="Líneas del seller (B)" value={result.b.entries.size} color={COLORS.blue} />
              <StatBox label="Ya cargadas" value={result.common.length} color={COLORS.green} />
              <StatBox label="Faltan en el seller" value={result.onlyInA.length} color={COLORS.yellow} />
              <StatBox label="Dupes A" value={result.a.duplicates.size} color={COLORS.muted} />
              <StatBox label="Dupes B" value={result.b.duplicates.size} color={COLORS.muted} />
            </div>

            {/* Controls */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <button onClick={handleReset} style={{
                background: "transparent",
                border: `1px solid ${COLORS.border}`,
                color: COLORS.text,
                borderRadius: 8,
                padding: "8px 16px",
                cursor: "pointer",
                fontSize: 13,
              }}>
                ← Nueva comparación
              </button>
              <button onClick={exportResult} style={{
                background: "transparent",
                border: `1px solid ${COLORS.green}`,
                color: COLORS.green,
                borderRadius: 8,
                padding: "8px 16px",
                cursor: "pointer",
                fontSize: 13,
              }}>
                ⬇ Exportar .txt
              </button>
              <select
                value={filter}
                onChange={e => setFilter(e.target.value)}
                style={{
                  background: COLORS.card,
                  border: `1px solid ${COLORS.border}`,
                  color: COLORS.text,
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 13,
                  maxWidth: 260,
                }}
              >
                <option value="">Todos los dominios</option>
                {domains.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <input
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="Filtrar por texto..."
                style={{
                  background: COLORS.card,
                  border: `1px solid ${COLORS.border}`,
                  color: COLORS.text,
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 13,
                  maxWidth: 240,
                  outline: "none",
                }}
              />
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  background: tab === t.id ? COLORS.accent : COLORS.card,
                  border: `1px solid ${tab === t.id ? COLORS.accent : COLORS.border}`,
                  color: tab === t.id ? "#fff" : COLORS.muted,
                  borderRadius: 8,
                  padding: "7px 18px",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab: Diferencias */}
            {tab === "diff" && (
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {[
                  ["Faltan en el seller", result.onlyInA, COLORS.yellow, "Tus líneas de demanda que el seller AÚN NO tiene en su ads.txt"],
                  ["Ya cargadas", result.common, COLORS.green, "Tus líneas que el seller YA tiene cargadas correctamente"],
                ].map(([label, entries, color, desc]) => (
                  <div key={label} style={{
                    flex: 1,
                    minWidth: 280,
                    background: COLORS.card,
                    borderRadius: 12,
                    padding: 16,
                    border: `1px solid ${COLORS.border}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <Badge color={color}>{label}</Badge>
                      <span style={{ color: COLORS.muted, fontSize: 12 }}>
                        {entries.filter(e => !filter || e.includes(filter.toLowerCase())).length} entradas
                      </span>
                    </div>
                    <p style={{ color: COLORS.muted, fontSize: 12, margin: "0 0 8px" }}>{desc}</p>
                    <EntryList entries={entries} color={color} filter={filter} />
                  </div>
                ))}
              </div>
            )}

            {/* Tab: Duplicados */}
            {tab === "dupes" && (
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {[["A", result.a.duplicates, COLORS.yellow], ["B", result.b.duplicates, COLORS.red]].map(([lbl, dupes, color]) => (
                  <div key={lbl} style={{
                    flex: 1,
                    minWidth: 280,
                    background: COLORS.card,
                    borderRadius: 12,
                    padding: 16,
                    border: `1px solid ${COLORS.border}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <Badge color={color}>Duplicados en {lbl}</Badge>
                      <span style={{ color: COLORS.muted, fontSize: 12 }}>{dupes.size}</span>
                    </div>
                    <EntryList entries={[...dupes]} color={color} filter={filter} />
                  </div>
                ))}
              </div>
            )}

            {/* Tab: Directivas */}
            {tab === "directives" && (
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {[["A", result.a.directives, COLORS.blue], ["B", result.b.directives, COLORS.accent]].map(([lbl, dirs, color]) => (
                  <div key={lbl} style={{
                    flex: 1,
                    minWidth: 280,
                    background: COLORS.card,
                    borderRadius: 12,
                    padding: 16,
                    border: `1px solid ${COLORS.border}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <Badge color={color}>Directivas en {lbl}</Badge>
                      <span style={{ color: COLORS.muted, fontSize: 12 }}>{dirs.length}</span>
                    </div>
                    <EntryList entries={dirs} color={color} filter={filter} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        </>}
      </div>
    </div>
  );
}

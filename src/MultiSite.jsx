import { useState, useMemo, useRef } from "react";
import { COLORS } from "./theme";
import { Badge, StatBox, EntryList } from "./components";
import { parseAdsTxt, parseDomainList } from "./adstxt";

const CONCURRENCY = 10;

const FILE_MODES = [
  { id: "both", label: "Ambos", files: ["app-ads.txt", "ads.txt"] },
  { id: "app-ads", label: "app-ads.txt", files: ["app-ads.txt"] },
  { id: "ads", label: "ads.txt", files: ["ads.txt"] },
];

async function fetchFile(domain, file) {
  const res = await fetch(`/api/adstxt?domain=${encodeURIComponent(domain)}&file=${file}`);
  return res.json();
}

// With several files, a line counts as present if it appears in any of them.
async function checkSite(domain, lines, files) {
  try {
    const fetched = await Promise.all(files.map(file => fetchFile(domain, file)));
    const found = fetched.filter(d => d.ok);
    if (!found.length) {
      const error = fetched.map(d => (files.length > 1 ? `${d.file}: ${d.error}` : d.error)).join(" · ");
      return { domain, ok: false, error };
    }
    const entries = new Set(found.flatMap(d => [...parseAdsTxt(d.body).entries]));
    return {
      domain,
      ok: true,
      files: found.map(d => d.file),
      urls: found.map(d => d.url),
      missing: lines.filter(l => !entries.has(l)),
    };
  } catch {
    return { domain, ok: false, error: "No responde el proxy (¿está corriendo npm run dev?)" };
  }
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadCsv(filename, rows) {
  const content = "﻿" + rows.map(r => r.map(csvCell).join(",")).join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const buttonStyle = (color) => ({
  background: "transparent",
  border: `1px solid ${color}`,
  color: color === COLORS.border ? COLORS.text : color,
  borderRadius: 8,
  padding: "8px 16px",
  cursor: "pointer",
  fontSize: 13,
});

const cardStyle = {
  background: COLORS.card,
  borderRadius: 12,
  padding: 16,
  border: `1px solid ${COLORS.border}`,
};

function ExpandableRow({ color, title, subtitle, expanded, onToggle, children }) {
  return (
    <div style={{
      borderLeft: `3px solid ${color}`,
      background: color + "11",
      borderRadius: 5,
      marginBottom: 4,
    }}>
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          padding: "6px 10px",
          cursor: "pointer",
        }}
      >
        <span style={{ fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" }}>
          {expanded ? "▾" : "▸"} {title}
        </span>
        <span style={{ color, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{subtitle}</span>
      </div>
      {expanded && <div style={{ padding: "0 10px 8px 22px" }}>{children}</div>}
    </div>
  );
}

export default function MultiSite() {
  const [linesText, setLinesText] = useState("");
  const [domainsText, setDomainsText] = useState("");
  const [fileMode, setFileMode] = useState("both");
  const [job, setJob] = useState(null);
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState("lines");
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState(null);
  const cancelRef = useRef(false);
  // Bumped on every new job so late responses from a previous job are dropped.
  const jobIdRef = useRef(0);

  const inputLines = useMemo(() => [...parseAdsTxt(linesText).entries], [linesText]);
  const inputDomains = useMemo(() => parseDomainList(domainsText), [domainsText]);

  const runChecks = async ({ lines, files }, domains) => {
    const jobId = jobIdRef.current;
    cancelRef.current = false;
    setRunning(true);
    const queue = [...domains];
    const worker = async () => {
      while (queue.length && !cancelRef.current) {
        const domain = queue.shift();
        const r = await checkSite(domain, lines, files);
        if (jobId !== jobIdRef.current) return;
        setResults(prev => ({ ...prev, [domain]: r }));
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    if (jobId === jobIdRef.current) setRunning(false);
  };

  const handleStart = () => {
    jobIdRef.current++;
    const newJob = {
      lines: inputLines,
      domains: inputDomains,
      files: FILE_MODES.find(m => m.id === fileMode).files,
    };
    setJob(newJob);
    setResults({});
    setFilter("");
    setExpanded(null);
    runChecks(newJob, inputDomains);
  };

  const handleReset = () => {
    cancelRef.current = true;
    jobIdRef.current++;
    setRunning(false);
    setJob(null);
    setResults({});
  };

  const summary = useMemo(() => {
    if (!job) return null;
    const done = job.domains.filter(d => results[d]).map(d => results[d]);
    const okSites = done.filter(r => r.ok);
    const failed = done.filter(r => !r.ok).sort((a, b) => a.domain.localeCompare(b.domain));

    const missingBy = new Map(job.lines.map(l => [l, []]));
    for (const r of okSites) for (const l of r.missing) missingBy.get(l).push(r.domain);

    const byLine = job.lines
      .map(line => ({ line, missingIn: missingBy.get(line).sort() }))
      .sort((a, b) => b.missingIn.length - a.missingIn.length || a.line.localeCompare(b.line));

    const bySite = [...okSites].sort((a, b) => b.missing.length - a.missing.length || a.domain.localeCompare(b.domain));

    return {
      done: done.length,
      okSites,
      failed,
      byLine,
      bySite,
      complete: okSites.filter(r => r.missing.length === 0).length,
    };
  }, [job, results]);

  const exportByLine = () => {
    downloadCsv("adstxt_por_linea.csv", [
      ["linea", "sitios_chequeados", "presente_en", "falta_en", "sitios_donde_falta"],
      ...summary.byLine.map(({ line, missingIn }) => [
        line,
        summary.okSites.length,
        summary.okSites.length - missingIn.length,
        missingIn.length,
        missingIn.join(" "),
      ]),
    ]);
  };

  const exportBySite = () => {
    const rows = job.domains.filter(d => results[d]).map(d => {
      const r = results[d];
      const missing = new Set(r.missing || []);
      return [
        d,
        r.ok ? "ok" : "error",
        r.error || "",
        (r.files || []).join(" + "),
        r.ok ? r.missing.length : "",
        ...job.lines.map(l => (r.ok ? (missing.has(l) ? "NO" : "SI") : "")),
      ];
    });
    downloadCsv("adstxt_por_sitio.csv", [["sitio", "estado", "error", "archivos", "faltantes", ...job.lines], ...rows]);
  };

  if (!job) {
    const canStart = inputLines.length > 0 && inputDomains.length > 0;
    return (
      <>
        <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
          {[
            ["A", linesText, setLinesText, "Tus líneas de demanda", `${inputLines.length} líneas`, "Pegá acá las líneas que todos los sitios deberían tener..."],
            ["B", domainsText, setDomainsText, "Sitios", `${inputDomains.length} sitios`, "Pegá acá los dominios, uno por línea (ej: sitio.com)..."],
          ].map(([label, val, setter, title, count, ph]) => (
            <div key={label} style={{ flex: 1, minWidth: 280 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "baseline" }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>
                  {label} · <span style={{ color: COLORS.accent }}>{title}</span>
                </span>
                <span style={{ color: COLORS.muted, fontSize: 12 }}>{count}</span>
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
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: COLORS.muted, marginRight: 4 }}>Archivo a chequear:</span>
          {FILE_MODES.map(m => (
            <button key={m.id} onClick={() => setFileMode(m.id)} style={{
              background: fileMode === m.id ? COLORS.accent : COLORS.card,
              border: `1px solid ${fileMode === m.id ? COLORS.accent : COLORS.border}`,
              color: fileMode === m.id ? "#fff" : COLORS.muted,
              borderRadius: 8,
              padding: "6px 14px",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}>
              {m.label}
            </button>
          ))}
          {fileMode === "both" && (
            <span style={{ fontSize: 12, color: COLORS.muted, marginLeft: 4 }}>
              Una línea cuenta como presente si está en app-ads.txt o en ads.txt.
            </span>
          )}
        </div>
        <button
          onClick={handleStart}
          disabled={!canStart}
          style={{
            background: COLORS.accent,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "10px 28px",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            opacity: canStart ? 1 : 0.5,
          }}
        >
          Chequear {inputDomains.length} sitios →
        </button>
      </>
    );
  }

  const total = job.domains.length;
  const f = filter.toLowerCase();
  const TABS = [
    { id: "lines", label: "Por línea" },
    { id: "sites", label: "Por sitio" },
    { id: "errors", label: `Errores (${summary.failed.length})` },
  ];

  return (
    <>
      {/* Progress */}
      <div style={{ ...cardStyle, marginBottom: 16, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
          <span>
            {running ? `Descargando ${job.files.join(" + ")}…` : summary.done < total ? "Cancelado" : "Listo"}
          </span>
          <span style={{ color: COLORS.muted }}>{summary.done} / {total}</span>
        </div>
        <div style={{ height: 6, background: COLORS.border, borderRadius: 3, overflow: "hidden" }}>
          <div style={{
            width: `${(summary.done / total) * 100}%`,
            height: "100%",
            background: running ? COLORS.accent : COLORS.green,
            transition: "width 0.2s",
          }} />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <StatBox label="Líneas de demanda" value={job.lines.length} color={COLORS.blue} />
        <StatBox label="Sitios" value={total} color={COLORS.blue} />
        <StatBox label="Sitios leídos" value={summary.okSites.length} color={COLORS.blue} />
        <StatBox label="Tienen todas" value={summary.complete} color={COLORS.green} />
        <StatBox label="Con faltantes" value={summary.okSites.length - summary.complete} color={COLORS.yellow} />
        <StatBox label="Sin archivo / error" value={summary.failed.length} color={COLORS.red} />
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={handleReset} style={buttonStyle(COLORS.border)}>← Nuevo chequeo</button>
        {running ? (
          <button onClick={() => { cancelRef.current = true; }} style={buttonStyle(COLORS.red)}>■ Cancelar</button>
        ) : (
          <>
            {summary.failed.length > 0 && (
              <button
                onClick={() => runChecks(job, summary.failed.map(r => r.domain))}
                style={buttonStyle(COLORS.yellow)}
              >
                ↻ Reintentar errores ({summary.failed.length})
              </button>
            )}
            {summary.done < total && (
              <button
                onClick={() => runChecks(job, job.domains.filter(d => !results[d]))}
                style={buttonStyle(COLORS.accent)}
              >
                ▶ Continuar ({total - summary.done})
              </button>
            )}
          </>
        )}
        <button onClick={exportByLine} disabled={!summary.done} style={buttonStyle(COLORS.green)}>⬇ CSV por línea</button>
        <button onClick={exportBySite} disabled={!summary.done} style={buttonStyle(COLORS.green)}>⬇ CSV por sitio</button>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder={tab === "lines" ? "Filtrar líneas..." : "Filtrar sitios..."}
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
          <button key={t.id} onClick={() => { setTab(t.id); setExpanded(null); }} style={{
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

      {/* Tab: Por línea */}
      {tab === "lines" && (
        <div style={cardStyle}>
          <p style={{ color: COLORS.muted, fontSize: 12, margin: "0 0 10px" }}>
            Cada línea de demanda y en cuántos de los {summary.okSites.length} sitios leídos está presente. Hacé click para ver los sitios donde falta.
          </p>
          {summary.byLine
            .filter(({ line }) => !f || line.includes(f))
            .map(({ line, missingIn }) => {
              const present = summary.okSites.length - missingIn.length;
              return (
                <ExpandableRow
                  key={line}
                  color={missingIn.length ? COLORS.yellow : COLORS.green}
                  title={line}
                  subtitle={`${present}/${summary.okSites.length} · falta en ${missingIn.length}`}
                  expanded={expanded === line}
                  onToggle={() => setExpanded(expanded === line ? null : line)}
                >
                  <EntryList entries={missingIn} color={COLORS.yellow} />
                </ExpandableRow>
              );
            })}
        </div>
      )}

      {/* Tab: Por sitio */}
      {tab === "sites" && (
        <div style={cardStyle}>
          <p style={{ color: COLORS.muted, fontSize: 12, margin: "0 0 10px" }}>
            Sitios donde se pudo leer al menos un archivo, ordenados por cantidad de líneas faltantes.
          </p>
          {summary.bySite
            .filter(r => !f || r.domain.includes(f))
            .map(r => (
              <ExpandableRow
                key={r.domain}
                color={r.missing.length ? COLORS.yellow : COLORS.green}
                title={r.domain}
                subtitle={r.missing.length ? `faltan ${r.missing.length}/${job.lines.length}` : "✓ completo"}
                expanded={expanded === r.domain}
                onToggle={() => setExpanded(expanded === r.domain ? null : r.domain)}
              >
                {r.urls.map(u => <div key={u} style={{ color: COLORS.muted, fontSize: 11, margin: "2px 0" }}>{u}</div>)}
                <EntryList entries={r.missing} color={COLORS.yellow} />
              </ExpandableRow>
            ))}
        </div>
      )}

      {/* Tab: Errores */}
      {tab === "errors" && (
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Badge color={COLORS.red}>Sin archivo / error</Badge>
            <span style={{ color: COLORS.muted, fontSize: 12 }}>{summary.failed.length} sitios</span>
          </div>
          <p style={{ color: COLORS.muted, fontSize: 12, margin: "0 0 8px" }}>
            Sitios donde no se pudo leer ningún archivo. No cuentan en el resumen por línea.
          </p>
          <EntryList
            entries={summary.failed.map(r => `${r.domain} — ${r.error}`)}
            color={COLORS.red}
            filter={filter}
          />
        </div>
      )}
    </>
  );
}

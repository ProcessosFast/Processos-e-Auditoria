import { useState, useEffect, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line,
  PieChart, Pie, Legend
} from "recharts";

// ── IDENTIDADE FAST ──────────────────────────────────────────────
const F = {
  red: "#E8001D",
  redDark: "#B8001A",
  redDim: "rgba(232,0,29,0.1)",
  redBorder: "rgba(232,0,29,0.25)",
  white: "#FFFFFF",
  offWhite: "#F5F4F2",
  black: "#0A0A0A",
  charcoal: "#1A1A1A",
  gray1: "#2A2A2A",
  gray2: "#3A3A3A",
  gray3: "#555555",
  gray4: "#888888",
  gray5: "#BBBBBB",
  gray6: "#E5E5E5",
  green: "#00B050",
  greenDim: "rgba(0,176,80,0.1)",
  amber: "#FF8C00",
  amberDim: "rgba(255,140,0,0.1)",
  blue: "#0066CC",
  blueDim: "rgba(0,102,204,0.1)",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Barlow:wght@400;500;600&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Barlow',sans-serif; background:${F.offWhite}; color:${F.charcoal}; }
  ::-webkit-scrollbar { width:5px; height:5px; }
  ::-webkit-scrollbar-track { background:${F.gray6}; }
  ::-webkit-scrollbar-thumb { background:${F.red}; border-radius:3px; }
  input,select,textarea { font-family:'Barlow',sans-serif; }
  input:not([type="date"]):not([type="url"]):not([type="email"]), textarea { text-transform: uppercase; }
  button { font-family:'Barlow',sans-serif; }
  @keyframes slideIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
  .anim { animation: slideIn 0.35s ease both; }
  .anim2 { animation: slideIn 0.35s ease 0.1s both; }
  .anim3 { animation: slideIn 0.35s ease 0.2s both; }
  .anim4 { animation: slideIn 0.35s ease 0.3s both; }
`;

// ── CHECKLIST DATA ────────────────────────────────────────────────
const CAUSAS_RAIZ = [
  "Processo inexistente",
  "Processo inadequado",
  "Falta de treinamento",
  "Falha sistêmica",
  "Comunicação inadequada",
  "Indisciplina operacional",
  "Falha de governança",
  "Falha de controle",
];

const CL_BASE = [
  "O processo está documentado e atualizado?",
  "Os responsáveis conhecem e seguem o procedimento?",
  "Os registros de execução estão sendo mantidos?",
  "Há evidências de treinamento da equipe envolvida?",
  "O processo foi revisado nos últimos 6 meses?",
  "Existem indicadores de desempenho definidos?",
];

// ── HELPERS ───────────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function fmtDate(d) {
  if (!d) return "—";
  try { return new Date(d + "T00:00").toLocaleDateString("pt-BR"); } catch { return d; }
}
function scoreColor(s) {
  if (s >= 85) return F.green;
  if (s >= 65) return F.amber;
  return F.red;
}
function scoreLabel(s) {
  if (s >= 90) return "Excelente";
  if (s >= 75) return "Conforme";
  if (s >= 60) return "Em Atenção";
  return "Crítico";
}
function isAtrasado(p) {
  return p.status !== "concluido" && p.prazo && new Date(p.prazo) < new Date();
}

function scoreAreaCiclo(areaId, auditorias) {
  const auds = auditorias.filter(a => a.areaId === areaId);
  if (!auds.length) return null;
  const byCiclo = {};
  auds.forEach(a => {
    const k = a.cicloNome || "sem-ciclo";
    if (!byCiclo[k]) byCiclo[k] = [];
    byCiclo[k].push(a.score);
  });
  const cicloAvgs = Object.values(byCiclo).map(sc => sc.reduce((s, x) => s + x, 0) / sc.length);
  return Math.round(cicloAvgs.reduce((s, x) => s + x, 0) / cicloAvgs.length);
}

// ── PERMISSÕES ───────────────────────────────────────────────────
const PERMISSOES = {
  administrador: {
    views: ["dashboard","areas","processos","auditorias","planos","elaborar","ncs","ciclos","comite","usuarios","modulos"],
    acoes: new Set(["criar","excluir","aprovar","exportar","auditar","atualizar-status","gerir-modulos","gerir-ciclos","gerir-comite","liberar-relatorios","agendar-reuniao","comentar-auditoria","relatorio-final","elaborar-plano"])
  },
  "auditor-lider": {
    views: ["dashboard","areas","processos","auditorias","planos","ncs","ciclos","comite","modulos"],
    acoes: new Set(["auditar","exportar","gerir-ciclos","gerir-comite","agendar-reuniao","relatorio-final","comentar-auditoria"])
  },
  auditor: {
    views: ["dashboard","areas","processos","auditorias","planos","ncs","ciclos","comite","modulos"],
    acoes: new Set(["auditar","exportar"])
  },
  comite: {
    views: ["dashboard","auditorias","processos","planos","comite"],
    acoes: new Set(["exportar","comentar-auditoria","votar-enquete"])
  },
  gestor: {
    views: ["planos","auditorias"],
    acoes: new Set(["atualizar-status"])
  }
};
function podeAcessar(perfil, viewId) { return PERMISSOES[perfil]?.views.includes(viewId) ?? false; }
function podeExecutar(perfil, acao) { return PERMISSOES[perfil]?.acoes.has(acao) ?? false; }
const PERFIL_LABEL = {
  administrador: "Administrador", comite: "Comitê", gestor: "Gestor de Área",
  "auditor-lider": "Auditor Líder", auditor: "Auditor", diretoria: "Diretoria", operacional: "Operacional"
};
const PERFIL_COR = {
  administrador: "#E8001D", comite: "#9b6dff", gestor: "#0066CC",
  "auditor-lider": "#00875A", auditor: "#00B050", diretoria: "#FF8C00", operacional: "#555555"
};

// ── PILL ──────────────────────────────────────────────────────────
function Pill({ color = F.green, bg = F.greenDim, children }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 700, padding: "3px 9px",
      borderRadius: 20, background: bg, color, whiteSpace: "nowrap",
      fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 0.5,
      textTransform: "uppercase"
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0 }} />
      {children}
    </span>
  );
}

// ── TAG ───────────────────────────────────────────────────────────
function Tag({ children, color = F.gray3, bg = F.gray6 }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 7px",
      borderRadius: 3, background: bg, color,
      fontFamily: "'Barlow Condensed',sans-serif",
      letterSpacing: 0.5, textTransform: "uppercase"
    }}>{children}</span>
  );
}

// ── BUTTON ────────────────────────────────────────────────────────
function Btn({ variant = "primary", onClick, children, style = {} }) {
  const styles = {
    primary: { background: F.red, color: "#fff", border: "none" },
    ghost: { background: "#fff", color: F.charcoal, border: `1.5px solid ${F.gray6}` },
    danger: { background: F.redDim, color: F.red, border: `1.5px solid ${F.redBorder}` },
  };
  return (
    <button onClick={onClick} style={{
      ...styles[variant],
      padding: "8px 16px", borderRadius: 6, fontSize: 13,
      fontWeight: 600, cursor: "pointer", display: "inline-flex",
      alignItems: "center", gap: 5, transition: "all 0.15s",
      fontFamily: "'Barlow',sans-serif", ...style
    }}>{children}</button>
  );
}

// ── MODAL ─────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, footer, width = 560 }) {
  if (!open) return null;
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, background: "rgba(10,10,10,0.6)",
      backdropFilter: "blur(4px)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "fadeIn 0.2s ease"
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, width, maxWidth: "95vw",
        maxHeight: "88vh", display: "flex", flexDirection: "column",
        overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
        animation: "slideIn 0.25s ease"
      }}>
        <div style={{
          padding: "18px 24px 16px", borderBottom: `1px solid ${F.gray6}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0
        }}>
          <div style={{
            fontFamily: "'Barlow Condensed',sans-serif",
            fontSize: 20, fontWeight: 800, color: F.charcoal,
            textTransform: "uppercase", letterSpacing: 0.5
          }}>{title}</div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 6, background: F.gray6,
            border: "none", cursor: "pointer", fontSize: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: F.gray3
          }}>✕</button>
        </div>
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>{children}</div>
        {footer && (
          <div style={{
            padding: "14px 24px", borderTop: `1px solid ${F.gray6}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0, background: "#fafafa"
          }}>{footer}</div>
        )}
      </div>
    </div>
  );
}

// ── FORM COMPONENTS ───────────────────────────────────────────────
function FG({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{
        display: "block", fontSize: 10, fontWeight: 700,
        color: F.gray4, textTransform: "uppercase", letterSpacing: 1,
        marginBottom: 6, fontFamily: "'Barlow Condensed',sans-serif"
      }}>{label}</label>}
      {children}
    </div>
  );
}
const fi = {
  width: "100%", background: F.offWhite, border: `1.5px solid ${F.gray6}`,
  borderRadius: 7, color: F.charcoal, fontSize: 13.5, padding: "8px 12px",
  outline: "none", transition: "border-color 0.15s", textTransform: "uppercase"
};

// ── CARD ──────────────────────────────────────────────────────────
function Card({ children, style = {}, className = "" }) {
  return (
    <div className={className} style={{
      background: "#fff", border: `1px solid ${F.gray6}`,
      borderRadius: 10, padding: 20, ...style
    }}>{children}</div>
  );
}

// ── STAT CARD ─────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent, delay = 0 }) {
  return (
    <div className="anim" style={{
      background: "#fff", borderRadius: 10, padding: "18px 20px",
      border: `1px solid ${F.gray6}`, position: "relative",
      overflow: "hidden", animationDelay: `${delay}s`
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        height: 3, background: accent
      }} />
      <div style={{
        fontSize: 10, fontWeight: 700, color: F.gray4,
        textTransform: "uppercase", letterSpacing: 1,
        marginBottom: 10, fontFamily: "'Barlow Condensed',sans-serif"
      }}>{label}</div>
      <div style={{
        fontFamily: "'Barlow Condensed',sans-serif",
        fontSize: 34, fontWeight: 900, lineHeight: 1,
        color: value === "—" ? F.gray5 : F.charcoal, marginBottom: 6
      }}>{value}</div>
      <div style={{ fontSize: 12, color: F.gray4 }}>{sub}</div>
    </div>
  );
}

// ── DATA TABLE ────────────────────────────────────────────────────
function DataTable({ cols, rows, empty }) {
  if (!rows.length) return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "40px 20px", gap: 8, textAlign: "center"
    }}>
      <div style={{ fontSize: 32, opacity: 0.2 }}>{empty.icon}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: F.gray3 }}>{empty.title}</div>
      {empty.sub && <div style={{ fontSize: 12.5, color: F.gray4, maxWidth: 300, lineHeight: 1.6 }}>{empty.sub}</div>}
      {empty.action}
    </div>
  );
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          {cols.map((c, i) => (
            <th key={i} style={{
              fontSize: 10, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: 1, color: F.gray4, padding: "7px 10px",
              textAlign: "left", borderBottom: `1.5px solid ${F.gray6}`,
              fontFamily: "'Barlow Condensed',sans-serif"
            }}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ borderBottom: `1px solid ${F.gray6}` }}
            onMouseEnter={e => e.currentTarget.style.background = F.offWhite}
            onMouseLeave={e => e.currentTarget.style.background = ""}
          >
            {r}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function TD({ children, style = {} }) {
  return <td style={{ padding: "10px 10px", fontSize: 13, verticalAlign: "middle", ...style }}>{children}</td>;
}

// ── STEPS ─────────────────────────────────────────────────────────
function Steps({ step }) {
  const items = ["Identificação", "Checklist", "Resultado"];
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 22 }}>
      {items.map((s, i) => (
        <>
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700,
              background: i + 1 < step ? F.green : i + 1 === step ? F.red : F.gray6,
              color: i + 1 <= step ? "#fff" : F.gray4,
              border: i + 1 === step ? `2px solid ${F.red}` : "none"
            }}>
              {i + 1 < step ? "✓" : i + 1}
            </div>
            <span style={{
              fontSize: 12, fontWeight: 600,
              color: i + 1 === step ? F.charcoal : i + 1 < step ? F.green : F.gray4,
              fontFamily: "'Barlow Condensed',sans-serif",
              textTransform: "uppercase", letterSpacing: 0.5
            }}>{s}</span>
          </div>
          {i < items.length - 1 && (
            <div key={`l${i}`} style={{
              flex: 1, height: 1.5, background: i + 1 < step ? F.green : F.gray6, margin: "0 8px"
            }} />
          )}
        </>
      ))}
    </div>
  );
}

// ── TOAST ─────────────────────────────────────────────────────────
function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 999,
      background: type === "ok" ? F.green : F.red, color: "#fff",
      padding: "11px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
      boxShadow: "0 6px 20px rgba(0,0,0,0.2)", animation: "slideIn 0.3s ease",
      fontFamily: "'Barlow',sans-serif"
    }}>
      {type === "ok" ? "✓ " : "✕ "}{msg}
    </div>
  );
}

// ── AREA SELECTION SCREEN ────────────────────────────────────────
function AreaSelectionScreen({ areas, usuario, onSelect, onBack }) {
  return (
    <div style={{ minHeight: "100vh", background: F.offWhite, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <style>{css}</style>
      <div style={{ width: 36, height: 36, background: F.red, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: "#fff", fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 20 }}>
        {usuario.ini}
      </div>
      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1, color: F.charcoal, marginBottom: 6 }}>
        Selecione sua área
      </div>
      <div style={{ fontSize: 13, color: F.gray4, marginBottom: 32 }}>
        Olá, <strong>{usuario.nome}</strong> — escolha a área que você gerencia
      </div>

      {areas.filter(a => !a.naoAuditada && !a.noa).length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 12, padding: 28, maxWidth: 380, border: `1.5px solid ${F.redBorder}`, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: F.gray3, lineHeight: 1.8 }}>
            Nenhuma área auditável cadastrada.<br/>Peça ao administrador para cadastrar as áreas primeiro.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", maxWidth: 640 }}>
          {areas.filter(a => !a.naoAuditada && !a.noa).map((a, i) => (
            <div key={a.id} className="anim" onClick={() => onSelect(a)}
              style={{ animationDelay: `${i * 0.05}s`, background: "#fff", borderRadius: 10, padding: "16px 20px", border: `1.5px solid ${F.gray6}`, cursor: "pointer", minWidth: 160, transition: "border-color 0.15s, box-shadow 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = F.red; e.currentTarget.style.boxShadow = "0 4px 16px rgba(232,0,29,0.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = F.gray6; e.currentTarget.style.boxShadow = "none"; }}
            >
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 800, color: F.charcoal, marginBottom: 4 }}>{a.nome}</div>
              {(a.categoria || a.grupo) && <div style={{ fontSize: 11, color: F.gray4 }}>{a.categoria || a.grupo}</div>}
              {(a.diretor?.nome || a.resp) && <div style={{ fontSize: 11, color: F.gray4, marginTop: 2 }}>{a.diretor?.nome || a.resp}</div>}
            </div>
          ))}
        </div>
      )}

      <button onClick={onBack} style={{ marginTop: 28, fontSize: 12, color: F.gray4, background: "none", border: "none", cursor: "pointer", fontFamily: "'Barlow',sans-serif" }}>
        ← Voltar para seleção de usuário
      </button>
    </div>
  );
}

// ── COMENTARIO INLINE ────────────────────────────────────────────
function ComentarioInline({ audId, onSave }) {
  const [texto, setTexto] = useState("");
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
      <input style={{ ...fi, flex: 1, fontSize: 12.5 }} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Adicionar comentário..." onKeyDown={e => { if (e.key === "Enter" && texto.trim()) { onSave(audId, texto); setTexto(""); } }} />
      <Btn onClick={() => { if (texto.trim()) { onSave(audId, texto); setTexto(""); } }} style={{ padding: "7px 12px", fontSize: 12 }}>Enviar</Btn>
    </div>
  );
}

// ── LOGIN SCREEN ─────────────────────────────────────────────────
const PERFIL_ORDEM = ["administrador","auditor-lider","auditor","gestor","comite","diretoria","operacional"];

function LoginScreen({ usuarios, onLogin }) {
  const [logoSrc, setLogoSrc] = useState("");
  const [aberto, setAberto] = useState(null);

  useEffect(() => {
    fetch("/logo-fast-sistemas-construtivos.svg")
      .then(r => r.text())
      .then(t => setLogoSrc(`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(t)))}`))
      .catch(() => {});
  }, []);

  // Agrupa usuários por perfil, mantendo a ordem definida
  const grupos = {};
  usuarios.forEach(u => {
    if (!grupos[u.perfil]) grupos[u.perfil] = [];
    grupos[u.perfil].push(u);
  });
  const perfisAtivos = PERFIL_ORDEM.filter(p => grupos[p]?.length > 0);

  function togglePerfil(p) {
    setAberto(a => a === p ? null : p);
  }

  return (
    <div style={{ minHeight: "100vh", background: F.offWhite, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <style>{css}</style>
      {logoSrc && <img src={logoSrc} alt="Fast Sistemas Construtivos" style={{ height: 58, marginBottom: 36 }} />}
      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 26, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1, color: F.charcoal, marginBottom: 6 }}>
        Selecione seu perfil
      </div>
      <div style={{ fontSize: 13, color: F.gray4, marginBottom: 32 }}>Portal de Gestão — Fast Sistemas Construtivos</div>

      {usuarios.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 12, padding: 32, maxWidth: 420, border: `1.5px solid ${F.redBorder}`, textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.18 }}>○</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: F.charcoal, marginBottom: 10 }}>Nenhum usuário cadastrado</div>
          <div style={{ fontSize: 13, color: F.gray3, lineHeight: 1.8 }}>
            Adicione um usuário administrador no <code style={{ background: F.offWhite, padding: "1px 6px", borderRadius: 3, fontSize: 12 }}>localStorage</code> com a chave <code style={{ background: F.offWhite, padding: "1px 6px", borderRadius: 3, fontSize: 12 }}>portal-fast-db</code>.
          </div>
        </div>
      ) : (
        <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 10 }}>
          {perfisAtivos.map((p, idx) => {
            const cor = PERFIL_COR[p] || F.gray3;
            const isOpen = aberto === p;
            const lista = grupos[p];
            return (
              <div key={p} className="anim" style={{ animationDelay: `${idx * 0.06}s` }}>
                {/* Card do perfil */}
                <div
                  onClick={() => togglePerfil(p)}
                  style={{
                    background: "#fff", padding: "14px 18px", cursor: "pointer",
                    borderRadius: isOpen ? "10px 10px 0 0" : 10,
                    border: `1.5px solid ${isOpen ? cor : F.gray6}`,
                    display: "flex", alignItems: "center", gap: 14,
                    transition: "border-color 0.15s, box-shadow 0.15s",
                    boxShadow: isOpen ? `0 2px 12px ${cor}22` : "none"
                  }}
                  onMouseEnter={e => { if (!isOpen) { e.currentTarget.style.borderColor = cor; e.currentTarget.style.boxShadow = `0 2px 12px ${cor}22`; } }}
                  onMouseLeave={e => { if (!isOpen) { e.currentTarget.style.borderColor = F.gray6; e.currentTarget.style.boxShadow = "none"; } }}
                >
                  <div style={{ width: 40, height: 40, background: cor, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 900, fontFamily: "'Barlow Condensed',sans-serif", flexShrink: 0 }}>
                    {lista.length > 1 ? lista.length : (lista[0].ini || lista[0].nome.slice(0, 2).toUpperCase())}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5, color: F.charcoal }}>
                      {PERFIL_LABEL[p] || p}
                    </div>
                    <div style={{ fontSize: 11, color: F.gray4, marginTop: 1 }}>
                      {lista.length} usuário{lista.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: isOpen ? cor : F.gray4, fontWeight: 700, transition: "transform 0.2s", display: "inline-block", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
                </div>

                {/* Lista de usuários expandida */}
                {isOpen && (
                  <div style={{ background: "#fff", border: `1.5px solid ${cor}`, borderTop: `1px solid ${F.gray6}`, borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
                    {lista.map((u, i) => (
                      <div
                        key={u.id}
                        onClick={() => onLogin(u)}
                        style={{
                          padding: "11px 18px", display: "flex", alignItems: "center", gap: 12,
                          cursor: "pointer", borderTop: i > 0 ? `1px solid ${F.gray6}` : "none",
                          transition: "background 0.12s"
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = F.offWhite}
                        onMouseLeave={e => e.currentTarget.style.background = "#fff"}
                      >
                        <div style={{ width: 32, height: 32, background: cor, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", flexShrink: 0 }}>
                          {u.ini || u.nome.slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: F.charcoal }}>{u.nome}</div>
                          {u.areaNome && u.areaNome !== "—" && <div style={{ fontSize: 11, color: F.gray4 }}>{u.areaNome}</div>}
                        </div>
                        <span style={{ fontSize: 13, color: F.gray4 }}>→</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════
export default function App() {
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [view, setView] = useState("dashboard");
  const [db, setDb] = useState(() => {
    const USUARIOS_PADRAO = [
      { id: "u-admin", nome: "Administrador", ini: "AD", email: "admin@fastdrywall.com.br", perfil: "administrador", areaId: "", areaNome: "—" },
      { id: "u-auditor-lider", nome: "Auditor Líder", ini: "AL", email: "auditor.lider@fastdrywall.com.br", perfil: "auditor-lider", areaId: "", areaNome: "—" },
      { id: "u-auditor", nome: "Auditor", ini: "AU", email: "auditor@fastdrywall.com.br", perfil: "auditor", areaId: "", areaNome: "—" },
      { id: "u-comite", nome: "Comitê", ini: "CO", email: "comite@fastdrywall.com.br", perfil: "comite", areaId: "", areaNome: "—" },
      { id: "u-gestor", nome: "Gestor da Área", ini: "GA", email: "gestor@fastdrywall.com.br", perfil: "gestor", areaId: "", areaNome: "—" },
    ];
    try {
      const salvo = localStorage.getItem("portal-fast-db");
      const base = salvo ? JSON.parse(salvo) : { areas: [], processos: [], auditorias: [], planos: [], ciclos: [], comite: [], usuarios: [], modulos: [], notificacoes: [] };
      if (!base.usuarios) base.usuarios = [];
      if (!base.modulos) base.modulos = [];
      if (!base.notificacoes) base.notificacoes = [];
      // Restaura usuários padrão que estiverem faltando
      USUARIOS_PADRAO.forEach(u => {
        if (!base.usuarios.find(x => x.id === u.id)) base.usuarios.push(u);
      });
      return base;
    } catch {
      return { areas: [], processos: [], auditorias: [], planos: [], ciclos: [], comite: [], usuarios: USUARIOS_PADRAO, modulos: [] };
    }
  });

  useEffect(() => {
    localStorage.setItem("portal-fast-db", JSON.stringify(db));
  }, [db]);
  const [toast, setToast] = useState(null);
  const [modals, setModals] = useState({});
  const [audStep, setAudStep] = useState(1);
  const [audForm, setAudForm] = useState({});
  const [checklist, setChecklist] = useState([]);

  const [notifOpen, setNotifOpen] = useState(false);
  const [idsLidos, setIdsLidos] = useState(new Set());
  const [idsNovos, setIdsNovos] = useState(new Set());
  const [expandedModulos, setExpandedModulos] = useState(new Set());
  const [historicoPlanId, setHistoricoPlanId] = useState(null);
  const [justificandoPlano, setJustificandoPlano] = useState(null);
  const [cienciaAuditoriaId, setCienciaAuditoriaId] = useState(null);
  const [comiteAba, setComiteAba] = useState("reunioes");
  const [relatorioFinalAudId, setRelatorioFinalAudId] = useState(null);
  const [viewRelatorioAudId, setViewRelatorioAudId] = useState(null);
  const planosIdsRef = useRef(new Set());

  useEffect(() => {
    const novos = db.planos.filter(p => !planosIdsRef.current.has(p.id));
    if (novos.length > 0) {
      setIdsNovos(s => new Set([...s, ...novos.map(p => p.id)]));
    }
    planosIdsRef.current = new Set(db.planos.map(p => p.id));
  }, [db.planos]);

  useEffect(() => {
    if (!usuarioLogado) return;
    const vp = PERMISSOES[usuarioLogado.perfil]?.views || [];
    if (!vp.includes(view)) setView(vp[0] || "dashboard");
  }, [view, usuarioLogado]);

  const prevAreasLenRef = useRef(null);
  useEffect(() => {
    if (prevAreasLenRef.current !== null && db.areas.length > prevAreasLenRef.current) {
      setUsuarioLogado(u => u?.perfil === "gestor" ? { ...u, areaId: "", areaNome: "—" } : u);
    }
    prevAreasLenRef.current = db.areas.length;
  }, [db.areas.length]);

  // ── LOGIN GUARD ──
  if (!usuarioLogado) {
    return <LoginScreen usuarios={db.usuarios} onLogin={u => { setUsuarioLogado(u); setView(u.perfil === "gestor" ? "planos" : "dashboard"); }} />;
  }
  const perfil = usuarioLogado.perfil;

  // ── ÁREA GUARD (gestor sem área definida) ──
  if (perfil === "gestor" && !usuarioLogado.areaId) {
    return (
      <AreaSelectionScreen
        areas={db.areas}
        usuario={usuarioLogado}
        onSelect={a => setUsuarioLogado(u => ({ ...u, areaId: a.id, areaNome: a.nome }))}
        onBack={() => setUsuarioLogado(null)}
      />
    );
  }

  function showToast(msg, type = "ok") { setToast({ msg, type }); }
  function openModal(id, data = {}) { setModals(m => ({ ...m, [id]: data })); }
  function closeModal(id) { setModals(m => { const n = { ...m }; delete n[id]; return n; }); }
  function upd(key, fn) { setDb(d => ({ ...d, [key]: fn(d[key]) })); }

  // ── EXPORTAR RELATÓRIO ──
  async function exportarRelatorio() {
    let logoSrc = "";
    try {
      const resp = await fetch("/logo-fast-sistemas-construtivos.svg");
      const svgText = await resp.text();
      logoSrc = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgText)))}`;
    } catch {}

    const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    const audsConc = db.auditorias.filter(a => a.status === "concluida");
    const conf = audsConc.length
      ? Math.round(audsConc.reduce((s, a) => s + a.score, 0) / audsConc.length)
      : null;
    const atrasados = db.planos.filter(p => p.status !== "concluido" && p.prazo && new Date(p.prazo) < new Date());

    const confPorArea = db.areas.filter(a => !a.naoAuditada && !a.noa).map(a => {
      const auds = db.auditorias.filter(x => x.areaId === a.id);
      const score = auds.length ? Math.round(auds.reduce((s, x) => s + x.score, 0) / auds.length) : null;
      return { nome: a.nome, grupo: a.categoria || a.grupo || "—", auds: auds.length, score, resp: a.diretor?.nome || a.resp || "—" };
    });

    const scoreClr = s => s >= 85 ? "#00B050" : s >= 65 ? "#FF8C00" : "#E8001D";
    const scoreLbl = s => s >= 90 ? "Excelente" : s >= 75 ? "Conforme" : s >= 60 ? "Em Atenção" : "Crítico";
    const pmap = { nc: "Não Conformidade", mel: "Melhoria", obs: "Observação" };
    const smap = { aberto: "Aberto", andamento: "Em Andamento", concluido: "Concluído" };

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Relatório Geral — Fast Sistemas Construtivos</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #1A1A1A; background: #fff; padding: 40px; }
  @media print { body { padding: 20px; } .no-print { display: none; } }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #E8001D; padding-bottom: 18px; margin-bottom: 28px; }
  .header img { height: 48px; }
  .header-right { text-align: right; color: #888; font-size: 12px; line-height: 1.7; }
  h2 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #888; margin: 28px 0 10px; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 8px; }
  .stat { border: 1px solid #E5E5E5; border-radius: 8px; padding: 14px 16px; border-top: 3px solid #E8001D; }
  .stat-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 6px; }
  .stat-value { font-size: 30px; font-weight: 900; line-height: 1; }
  .stat-sub { font-size: 11px; color: #888; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #888; padding: 7px 10px; text-align: left; border-bottom: 2px solid #E5E5E5; }
  td { padding: 9px 10px; border-bottom: 1px solid #F0F0F0; font-size: 12.5px; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .footer { margin-top: 40px; padding-top: 14px; border-top: 1px solid #E5E5E5; font-size: 11px; color: #aaa; text-align: center; }
  .print-btn { position: fixed; bottom: 24px; right: 24px; background: #E8001D; color: #fff; border: none; padding: 11px 22px; border-radius: 7px; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 16px rgba(232,0,29,0.35); }
  .empty { color: #aaa; font-style: italic; padding: 16px 10px; }
</style>
</head>
<body>
<div class="header">
  ${logoSrc ? `<img src="${logoSrc}" alt="Fast Sistemas Construtivos"/>` : `<span style="font-family:Arial Black,sans-serif;font-size:28px;font-weight:900;color:#1A1A1A">FAST</span>`}
  <div class="header-right">
    <strong>Relatório Geral de Conformidade</strong><br/>
    Gerado em ${hoje}<br/>
    Portal de Gestão — Fast Sistemas Construtivos
  </div>
</div>

<h2>Resumo Executivo</h2>
<div class="stats">
  <div class="stat">
    <div class="stat-label">Áreas Auditáveis</div>
    <div class="stat-value">${db.areas.filter(a => !a.naoAuditada && !a.noa).length || "—"}</div>
    <div class="stat-sub">${db.areas.length} área(s) cadastrada(s)</div>
  </div>
  <div class="stat">
    <div class="stat-label">Auditorias Realizadas</div>
    <div class="stat-value">${audsConc.length || "—"}</div>
    <div class="stat-sub">${db.auditorias.length} no total</div>
  </div>
  <div class="stat">
    <div class="stat-label">Ações em Atraso</div>
    <div class="stat-value" style="color:${atrasados.length > 0 ? "#E8001D" : "#1A1A1A"}">${db.planos.length ? atrasados.length : "—"}</div>
    <div class="stat-sub">${db.planos.length} plano(s) no total</div>
  </div>
  <div class="stat">
    <div class="stat-label">Conformidade Geral</div>
    <div class="stat-value" style="color:${conf !== null ? scoreClr(conf) : "#1A1A1A"}">${conf !== null ? conf + "%" : "—"}</div>
    <div class="stat-sub">${conf !== null ? scoreLbl(conf) : "Sem dados"}</div>
  </div>
</div>

<h2>Conformidade por Área</h2>
${confPorArea.length ? `<table>
  <thead><tr><th>Área</th><th>Grupo</th><th>Responsável</th><th>Auditorias</th><th>Score Médio</th><th>Status</th></tr></thead>
  <tbody>
    ${confPorArea.map(a => `<tr>
      <td><strong>${a.nome}</strong></td>
      <td>${a.grupo}</td>
      <td>${a.resp}</td>
      <td>${a.auds}</td>
      <td>${a.score !== null ? `<strong style="color:${scoreClr(a.score)}">${a.score}%</strong>` : "—"}</td>
      <td>${a.score !== null ? `<span class="pill" style="background:${scoreClr(a.score)}22;color:${scoreClr(a.score)}">${scoreLbl(a.score)}</span>` : "—"}</td>
    </tr>`).join("")}
  </tbody>
</table>` : `<p class="empty">Nenhuma área cadastrada.</p>`}

<h2>Histórico de Auditorias</h2>
${db.auditorias.length ? `<table>
  <thead><tr><th>Área</th><th>Auditor</th><th>Data</th><th>Ciclo</th><th>Score</th><th>NCs</th></tr></thead>
  <tbody>
    ${[...db.auditorias].reverse().map(a => {
      const ncc = (a.ncs || []).filter(n => n.clas === "nc").length;
      return `<tr>
        <td><strong>${a.areaNome}</strong>${a.local ? `<br/><span style="font-size:11px;color:#888">${a.local}</span>` : ""}</td>
        <td>${a.auditorNome}</td>
        <td>${fmtDate(a.data)}</td>
        <td>${a.cicloNome !== "—" ? a.cicloNome : "—"}</td>
        <td><strong style="color:${scoreClr(a.score)};font-size:15px">${a.score}%</strong></td>
        <td>${ncc > 0 ? `<span class="pill" style="background:#E8001D22;color:#E8001D">${ncc} NC</span>` : "—"}</td>
      </tr>`;
    }).join("")}
  </tbody>
</table>` : `<p class="empty">Nenhuma auditoria registrada.</p>`}

<h2>Relatórios de Conclusão</h2>
${db.planos.length ? `<table>
  <thead><tr><th>Descrição</th><th>Área</th><th>Responsável</th><th>Prazo</th><th>Classificação</th><th>Status</th></tr></thead>
  <tbody>
    ${db.planos.map(p => {
      const at = p.status !== "concluido" && p.prazo && new Date(p.prazo) < new Date();
      return `<tr>
        <td style="max-width:220px">${p.desc}${p.origem === "auditoria" ? `<br/><span style="font-size:10px;color:#aaa">via auditoria</span>` : ""}</td>
        <td>${p.areaNome}</td>
        <td>${p.resp || "—"}</td>
        <td style="color:${at ? "#E8001D" : "inherit"}">${fmtDate(p.prazo)}${at ? `<br/><span style="font-size:10px;font-weight:700;color:#E8001D">Atrasado</span>` : ""}</td>
        <td>${pmap[p.clas] || "—"}</td>
        <td>${smap[p.status] || p.status}</td>
      </tr>`;
    }).join("")}
  </tbody>
</table>` : `<p class="empty">Nenhum relatório de conclusão cadastrado.</p>`}

<div class="footer">Fast Sistemas Construtivos — Portal de Gestão Interno — ${hoje}</div>

<button class="print-btn no-print" onclick="window.print()">🖨 Imprimir / Salvar PDF</button>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    if (!win) showToast("Permita pop-ups para abrir o relatório.", "err");
  }

  // ── DADOS FILTRADOS POR PERFIL ──
  const planosVisiveis = perfil === "gestor"
    ? db.planos.filter(p => p.areaId === usuarioLogado.areaId && !p.aguardaComite)
    : db.planos.filter(p => !p.aguardaComite);
  const auditoriasVisiveis = perfil === "gestor"
    ? db.auditorias.filter(a => a.areaId === usuarioLogado.areaId)
    : db.auditorias;

  // ── STATS ──
  const areasAuditaveis = db.areas.filter(a => !a.naoAuditada && !a.noa);
  const audsConcluidas = auditoriasVisiveis.filter(a => a.status === "concluida");
  const planosAprovados = planosVisiveis.filter(p => p.aprovacao === "aprovado");
  const planosPendAprov = planosVisiveis.filter(p => p.aprovacao === "pendente");
  const planosPendentes = planosAprovados.filter(p => p.status !== "concluido");
  const planosAtrasados = planosPendentes.filter(isAtrasado);
  const confGeral = (() => {
    const scores = areasAuditaveis.map(a => scoreAreaCiclo(a.id, auditoriasVisiveis)).filter(s => s !== null);
    return scores.length ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : null;
  })();

  // ── NOTIFICAÇÕES ──
  const notifDB = (db.notificacoes || []).filter(n => n.paraId === usuarioLogado.id && !n.lida);
  const notificacoes = [
    ...db.planos
      .filter(p => idsNovos.has(p.id))
      .map(p => ({ key: `novo-${p.id}`, tipo: "aprovacao", titulo: "Novo relatório — aprovação pendente", desc: p.desc, area: p.areaNome, prazo: p.prazo })),
    ...db.planos
      .filter(p => {
        if (p.status === "concluido" || p.aprovacao !== "aprovado" || !p.prazo) return false;
        const dias = Math.ceil((new Date(p.prazo + "T00:00") - new Date()) / 86400000);
        return dias >= 0 && dias <= 7;
      })
      .map(p => {
        const dias = Math.ceil((new Date(p.prazo + "T00:00") - new Date()) / 86400000);
        return { key: `prazo-${p.id}`, tipo: "prazo", titulo: dias === 0 ? "Vence hoje!" : `Vence em ${dias} dia${dias !== 1 ? "s" : ""}`, desc: p.desc, area: p.areaNome, prazo: p.prazo };
      }),
    ...notifDB.map(n => ({ key: `db-${n.id}`, tipo: n.tipo, titulo: n.titulo, desc: n.mensagem, area: n.meta?.areaNome || "", prazo: n.meta?.dataReuniao || "", dbId: n.id })),
  ].filter(n => !idsLidos.has(n.key));

  function marcarTodasLidas() {
    setIdsLidos(s => new Set([...s, ...notificacoes.map(n => n.key)]));
    upd("notificacoes", arr => arr.map(n => n.paraId === usuarioLogado.id ? { ...n, lida: true } : n));
    setNotifOpen(false);
  }

  // ── CHECKLIST BUILDER ──
  function buildChecklist(areaId) {
    const area = db.areas.find(a => a.id === areaId);
    const secs = [
      { title: "Verificação Geral", items: CL_BASE.map(q => ({ texto: q, peso: 1 })) }
    ];
    (db.modulos || [])
      .filter(m => m.ativo && (m.areaIds?.includes(areaId) || area?.blocoPerguntas?.includes(m.id)))
      .forEach(m => secs.push({ title: m.nome, items: m.perguntas.map(p => ({ texto: p.texto, peso: p.peso || 1 })) }));
    return secs.flatMap(sec =>
      sec.items.map(item => ({ id: uid(), sec: sec.title, q: item.texto, peso: item.peso || 1, resp: null, clas: null, obs: "", evidencia: "" }))
    );
  }

  function saveModulo(form, editId = null) {
    if (!form.nome?.trim()) { showToast("Informe o nome da categoria.", "err"); return; }
    if (!form.perguntas?.filter(p => p.texto?.trim()).length) { showToast("Adicione ao menos uma pergunta.", "err"); return; }
    const clean = { ...form, perguntas: form.perguntas.filter(p => p.texto?.trim()) };
    if (editId) {
      upd("modulos", arr => arr.map(m => m.id === editId ? { ...m, ...clean } : m));
      showToast("Categoria de avaliação atualizada!");
    } else {
      upd("modulos", arr => [...arr, { id: uid(), ativo: true, areaIds: [], processoIds: [], ...clean }]);
      showToast("Categoria de avaliação criada!");
    }
    closeModal("modulo");
  }

  function calcScore(cl) {
    const applicable = cl.filter(i => i.resp !== "na");
    if (!applicable.length) return 0;
    const total = applicable.reduce((s, i) => s + (i.peso || 1), 0);
    const ok = applicable.filter(i => i.resp === "ok").reduce((s, i) => s + (i.peso || 1), 0);
    return Math.round((ok / total) * 100);
  }

  // ── SAVE AREA ──
  function saveArea(form) {
    if (!form.nome?.trim()) { showToast("Informe o nome da área.", "err"); return; }
    if (form.id) {
      upd("areas", arr => arr.map(a => a.id === form.id ? { ...a, ...form } : a));
      closeModal("area"); showToast("Área atualizada!");
    } else {
      upd("areas", a => [...a, { id: uid(), ...form }]);
      closeModal("area"); showToast("Área cadastrada!");
    }
  }

  // ── SAVE PROCESSO ──
  function saveProcesso(form) {
    if (!form.nome?.trim() || !form.areaId) { showToast("Informe nome e área.", "err"); return; }
    const area = db.areas.find(a => a.id === form.areaId);
    upd("processos", p => [...p, { id: uid(), areaNome: area?.nome || "—", ...form }]);
    closeModal("processo"); showToast("Processo cadastrado!");
  }

  // ── SAVE CICLO ──
  function saveCiclo(form) {
    if (!form.nome?.trim()) { showToast("Informe o nome do ciclo.", "err"); return; }
    upd("ciclos", c => [...c, { id: uid(), status: "ativo", ...form }]);
    closeModal("ciclo"); showToast("Ciclo criado!");
  }

  // ── SAVE USUARIO ──
  function saveUsuario(form) {
    if (!form.nome?.trim() || !form.email?.trim()) { showToast("Informe nome e e-mail.", "err"); return; }
    const area = db.areas.find(a => a.id === form.areaId);
    upd("usuarios", u => [...u, {
      id: uid(), ini: form.ini || form.nome.slice(0, 2).toUpperCase(),
      areaNome: area?.nome || "—", ...form
    }]);
    closeModal("usuario"); showToast("Usuário cadastrado!");
  }

  // ── SAVE MEMBRO ──
  function saveMembro(form) {
    if (!form.usuarioId || !form.areaId) { showToast("Selecione usuário e área.", "err"); return; }
    const u = db.usuarios.find(x => x.id === form.usuarioId);
    const a = db.areas.find(x => x.id === form.areaId);
    upd("comite", c => [...c, { id: uid(), uNome: u?.nome || "—", aNome: a?.nome || "—", ...form }]);
    closeModal("membro"); showToast("Membro adicionado!");
  }

  // ── SAVE PLANO ──
  function savePlano(form, auto = false) {
    if (!form.desc?.trim()) { if (!auto) showToast("Informe a descrição.", "err"); return; }
    if (!auto && !form.respId) { showToast("Selecione um responsável.", "err"); return; }
    if (!auto && !form.causaRaiz) { showToast("Selecione a causa raiz.", "err"); return; }
    const evt = { data: new Date().toISOString(), acao: "Relatório criado", autor: auto ? "Sistema (Auditoria)" : usuarioLogado?.nome || "Sistema" };
    upd("planos", p => [...p, { id: uid(), status: "aberto", aprovacao: "pendente", historico: [evt], origem: auto ? "auditoria" : "manual", ...form }]);
    if (!auto) { closeModal("plano"); showToast("Relatório criado! Aguardando aprovação do administrador."); }
  }

  function aprovarPlano(id) {
    const evt = { data: new Date().toISOString(), acao: "Relatório aprovado", autor: usuarioLogado?.nome || "Sistema" };
    upd("planos", arr => arr.map(p => p.id === id ? { ...p, aprovacao: "aprovado", aprovadoPor: usuarioLogado?.nome || "—", aprovadoEm: new Date().toISOString(), historico: [...(p.historico || []), evt] } : p));
    showToast("Relatório aprovado!");
  }
  function rejeitarPlano(id) {
    const evt = { data: new Date().toISOString(), acao: "Relatório rejeitado", autor: usuarioLogado?.nome || "Sistema" };
    upd("planos", arr => arr.map(p => p.id === id ? { ...p, aprovacao: "rejeitado", rejeitadoPor: usuarioLogado?.nome || "—", rejeitadoEm: new Date().toISOString(), historico: [...(p.historico || []), evt] } : p));
    showToast("Relatório rejeitado.", "err");
  }
  function enviarNotificacao(paraId, titulo, mensagem, tipo, meta) {
    upd("notificacoes", arr => [...arr, { id: uid(), paraId, titulo, mensagem, tipo: tipo || "geral", meta: meta || {}, data: new Date().toISOString(), lida: false }]);
  }

  function marcarReuniaoComNotificacoes(audId, dataReuniao) {
    const aud = db.auditorias.find(a => a.id === audId);
    if (!aud) return;
    upd("auditorias", arr => arr.map(a => a.id === audId ? { ...a, comite: { ...(a.comite || {}), dataReuniao } } : a));
    const mensagem = `Reunião do Comitê agendada para ${fmtDate(dataReuniao)} — Auditoria: ${aud.areaNome}`;
    const meta = { auditoriaId: audId, areaNome: aud.areaNome, dataReuniao };
    db.usuarios.forEach(u => {
      if (["comite","administrador","auditor-lider","auditor"].includes(u.perfil)) {
        enviarNotificacao(u.id, "Reunião do Comitê Agendada", mensagem, "reuniao", meta);
      }
      if (u.perfil === "gestor" && u.areaId === aud.areaId) {
        enviarNotificacao(u.id, "Reunião do Comitê Agendada", mensagem, "reuniao", meta);
      }
    });
    showToast("Reunião agendada — notificações enviadas!");
  }

  function marcarReuniaoRealizada(audId, obs) {
    upd("auditorias", arr => arr.map(a => a.id === audId ? { ...a, comite: { ...(a.comite || {}), status: "realizada", realizadaEm: new Date().toISOString(), observacoes: obs || "" } } : a));
    showToast("Reunião marcada como realizada!");
  }

  function addComentarioAuditoria(audId, texto) {
    if (!texto?.trim()) return;
    const comentario = { id: uid(), usuarioId: usuarioLogado.id, usuarioNome: usuarioLogado.nome, texto, data: new Date().toISOString() };
    upd("auditorias", arr => arr.map(a => a.id === audId ? { ...a, comentarios: [...(a.comentarios || []), comentario] } : a));
  }

  function salvarRelatorioFinal(audId, form) {
    upd("auditorias", arr => arr.map(a => a.id === audId ? { ...a, relatorioFinal: { ...form, auditorId: usuarioLogado.id, auditorNome: usuarioLogado.nome, data: new Date().toISOString(), status: "enviado" } } : a));
    setRelatorioFinalAudId(null);
    showToast("Relatório final enviado ao administrador!");
  }

  function liberarRelatoriosGestor(audId) {
    const evt = { data: new Date().toISOString(), acao: "Liberado após reunião do comitê", autor: usuarioLogado?.nome || "Sistema" };
    const aud = db.auditorias.find(a => a.id === audId);
    upd("planos", arr => arr.map(p => p.auditoriaId === audId ? {
      ...p, aguardaComite: false, aprovacao: "pendente",
      enqueteComite: db.comite.reduce((acc, m) => ({ ...acc, [m.usuarioId]: null }), {}),
      historico: [...(p.historico || []), evt]
    } : p));
    db.comite.forEach(m => {
      const planos = db.planos.filter(p => p.auditoriaId === audId);
      planos.forEach(p => {
        enviarNotificacao(m.usuarioId, "Enquete: Aprovar Relatório de Conclusão", `Sua votação é necessária para o relatório: "${p.desc?.slice(0,60)}"`, "enquete", { planoId: p.id, areaNome: aud?.areaNome });
      });
    });
    showToast("Relatórios liberados — enquete enviada ao comitê!");
  }

  function salvarElaboracao(planoId, campos) {
    upd("planos", arr => arr.map(p => p.id === planoId ? { ...p, ...campos, elaborado: !!(campos.desc?.trim() && campos.prazo && campos.respId && campos.causaRaiz) } : p));
  }

  function enviarParaEnqueteComite(planoId) {
    const plano = db.planos.find(p => p.id === planoId);
    if (!plano) return;
    const evt = { data: new Date().toISOString(), acao: "Enviado para enquete do comitê", autor: usuarioLogado?.nome || "Sistema" };
    upd("planos", arr => arr.map(p => p.id === planoId ? {
      ...p,
      aguardaComite: false,
      aprovacao: "pendente",
      enqueteEnviada: true,
      enqueteComite: db.comite.reduce((acc, m) => ({ ...acc, [m.usuarioId]: null }), {}),
      historico: [...(p.historico || []), evt]
    } : p));
    db.comite.forEach(m => {
      enviarNotificacao(m.usuarioId, "Enquete: Aprovar Plano de Ação",
        `Sua votação é necessária para o plano: "${plano.desc?.slice(0, 60)}"`,
        "enquete", { planoId, areaNome: plano.areaNome }
      );
    });
    showToast("Plano enviado para enquete do comitê!");
  }

  function votarEnquete(planoId, voto) {
    upd("planos", arr => arr.map(p => p.id === planoId ? {
      ...p, enqueteComite: { ...(p.enqueteComite || {}), [usuarioLogado.id]: { voto, nome: usuarioLogado.nome, data: new Date().toISOString() } }
    } : p));
    upd("notificacoes", arr => arr.map(n => n.meta?.planoId === planoId && n.paraId === usuarioLogado.id ? { ...n, lida: true } : n));
    showToast(voto === "sim" ? "Voto registrado: Aprovado!" : "Voto registrado: Reprovado.");
  }

  function aprovarExtensao(id) {
    const evt = { data: new Date().toISOString(), acao: "Extensão de prazo aprovada", autor: usuarioLogado?.nome || "Sistema" };
    upd("planos", arr => arr.map(p => p.id === id && p.extensao ? { ...p, prazo: p.extensao.novoPrazo, extensao: { ...p.extensao, status: "aprovada", aprovadoPor: usuarioLogado?.nome || "—", aprovadoEm: new Date().toISOString() }, historico: [...(p.historico || []), evt] } : p));
    showToast("Extensão aprovada!");
  }
  function rejeitarExtensao(id) {
    const evt = { data: new Date().toISOString(), acao: "Extensão de prazo rejeitada", autor: usuarioLogado?.nome || "Sistema" };
    upd("planos", arr => arr.map(p => p.id === id ? { ...p, extensao: { ...p.extensao, status: "rejeitada" }, historico: [...(p.historico || []), evt] } : p));
    showToast("Extensão rejeitada.", "err");
  }

  // ── FINALIZAR AUDITORIA ──
  function finalizarAuditoria() {
    const area = db.areas.find(a => a.id === audForm.areaId);
    const auditor = db.usuarios.find(u => u.id === audForm.auditorId);
    const ciclo = db.ciclos.find(c => c.id === audForm.cicloId);
    const score = calcScore(checklist);
    const ncs = checklist.filter(i => i.resp === "nok");

    const audId = uid();
    const auditoria = {
      id: audId, areaNome: area?.nome || "—", areaId: audForm.areaId,
      auditorNome: auditor?.nome || "—", data: audForm.data,
      local: audForm.local, cicloNome: ciclo?.nome || "—",
      score, obs: audForm.obs, status: "concluida",
      ncs: ncs.map(i => ({ q: i.q, clas: i.clas || "obs", evidencia: i.evidencia || "" })),
      ciencia: null,
      comite: { dataReuniao: null, status: "aguardando", observacoes: "" }
    };

    ncs.filter(i => i.selected !== false).forEach(i => {
      const prazoMap = { nc: 30, mel: 45, obs: 60 };
      const prazo = new Date();
      prazo.setDate(prazo.getDate() + (prazoMap[i.clas || "obs"] || 30));
      savePlano({
        desc: i.q, areaId: audForm.areaId, areaNome: area?.nome || "—",
        respId: "", respNome: "", resp: "",
        prio: i.clas === "nc" ? "high" : i.clas === "mel" ? "mid" : "low",
        prazo: prazo.toISOString().split("T")[0], clas: i.clas || "obs",
        causaRaiz: i.causaRaiz || "",
        auditoriaId: audId, aguardaComite: true,
      }, true);
    });

    upd("auditorias", a => [...a, auditoria]);
    closeModal("auditoria"); setAudStep(1); setAudForm({}); setChecklist([]);
    showToast("Auditoria registrada com sucesso!");
  }

  // ── CHART DATA ──
  const chartConf = areasAuditaveis.map(a => {
    const score = scoreAreaCiclo(a.id, auditoriasVisiveis) || 0;
    return { name: a.nome.length > 14 ? a.nome.slice(0, 14) + "…" : a.nome, score, fill: score ? scoreColor(score) : F.gray6 };
  }).filter(a => a.score > 0);

  const chartEvolucao = auditoriasVisiveis.slice(-8).map(a => ({ name: a.areaNome.slice(0, 8), score: a.score }));

  const chartPlanos = [
    { name: "Concluídos", value: planosAprovados.filter(p => p.status === "concluido").length, fill: F.green },
    { name: "Em Andamento", value: planosAprovados.filter(p => p.status === "andamento").length, fill: F.amber },
    { name: "Abertos", value: planosAprovados.filter(p => p.status === "aberto").length, fill: F.blue },
    { name: "Atrasados", value: planosAtrasados.length, fill: F.red },
  ].filter(d => d.value > 0);

  // ── SIDEBAR ──
  const navItems = [
    { id: "dashboard", icon: "▦", label: "Dashboard", section: "Visão Geral" },
    { id: "areas", icon: "◉", label: "Áreas", section: "Operação" },
    { id: "processos", icon: "⬡", label: "Processos" },
    { id: "auditorias", icon: "◎", label: "Auditorias", badge: auditoriasVisiveis.filter(a => a.status === "aberta").length },
    { id: "elaborar", icon: "✍", label: "Elaborar Plano de Ação", badge: db.planos.filter(p => p.aguardaComite && !p.elaborado).length || 0, section: "Melhoria" },
    { id: "planos", icon: "◷", label: "Relatórios de Conclusão", badge: planosPendAprov.length || planosAtrasados.length },
    { id: "ncs", icon: "⚑", label: "Não Conformidades" },
    { id: "ciclos", icon: "◈", label: "Ciclos", section: "Gestão" },
    { id: "modulos", icon: "⊞", label: "Categorias de Avaliação" },
    { id: "comite", icon: "◐", label: "Comitê" },
    { id: "usuarios", icon: "○", label: "Usuários" },
  ].filter(item => podeAcessar(perfil, item.id));

  return (
    <>
      <style>{css}</style>
      <div style={{ display: "flex", minHeight: "100vh" }}>

        {/* SIDEBAR */}
        <aside style={{
          width: 220, minHeight: "100vh", background: F.charcoal,
          display: "flex", flexDirection: "column", position: "fixed",
          top: 0, left: 0, zIndex: 100
        }}>
          {/* LOGO */}
          <div style={{
            padding: "16px 18px",
            borderBottom: `1px solid ${F.gray2}`,
            background: "#fff"
          }}>
            <img
              src="/logo-fast-sistemas-construtivos.svg"
              alt="Fast Sistemas Construtivos"
              style={{ width: "100%", maxWidth: 176, height: "auto", display: "block" }}
            />
          </div>

          {/* NAV */}
          <nav style={{ padding: "12px 10px", flex: 1, display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
            {navItems.map(item => (
              <>
                {item.section && (
                  <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: 2,
                    textTransform: "uppercase", color: F.gray3,
                    padding: "12px 10px 5px",
                    fontFamily: "'Barlow Condensed',sans-serif"
                  }}>{item.section}</div>
                )}
                <button key={item.id} onClick={() => setView(item.id)} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 10px", borderRadius: 6, cursor: "pointer",
                  fontSize: 13, fontWeight: view === item.id ? 600 : 400,
                  color: view === item.id ? "#fff" : F.gray4,
                  background: view === item.id ? F.red : "transparent",
                  border: "none", width: "100%", textAlign: "left",
                  transition: "all 0.15s", fontFamily: "'Barlow',sans-serif"
                }}>
                  <span style={{ width: 14, textAlign: "center", fontSize: 13, flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge > 0 && (
                    <span style={{
                      background: view === item.id ? "rgba(255,255,255,0.25)" : F.red,
                      color: "#fff", fontSize: 9, fontWeight: 700,
                      padding: "1px 5px", borderRadius: 20
                    }}>{item.badge}</span>
                  )}
                </button>
              </>
            ))}
          </nav>

          {/* FOOTER */}
          <div style={{ padding: 12, borderTop: `1px solid ${F.gray2}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 7, background: F.gray1 }}>
              <div style={{ width: 30, height: 30, background: F.red, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                {usuarioLogado.ini || usuarioLogado.nome.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{usuarioLogado.nome}</div>
                <div style={{ fontSize: 9, color: F.gray3, textTransform: "uppercase", letterSpacing: 0.5 }}>{PERFIL_LABEL[perfil] || perfil}</div>
              </div>
              {perfil === "administrador" && (
                <button
                  title="Limpar todos os dados"
                  onClick={() => {
                    if (window.confirm("Apagar TODOS os dados do portal? Esta ação não pode ser desfeita.")) {
                      localStorage.removeItem("portal-fast-db");
                      window.location.reload();
                    }
                  }}
                  style={{ background: "none", border: "none", color: F.gray2, cursor: "pointer", fontSize: 13, padding: "2px 4px", flexShrink: 0, transition: "color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.color = F.red}
                  onMouseLeave={e => e.currentTarget.style.color = F.gray2}
                >🗑</button>
              )}
              <button
                onClick={() => setUsuarioLogado(null)}
                title="Sair"
                style={{ background: "none", border: "none", color: F.gray4, cursor: "pointer", fontSize: 16, padding: "2px 4px", flexShrink: 0, transition: "color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.color = F.red}
                onMouseLeave={e => e.currentTarget.style.color = F.gray4}
              >⏏</button>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main style={{ marginLeft: 220, flex: 1, display: "flex", flexDirection: "column" }}>

          {/* TOPBAR */}
          <div style={{
            padding: "14px 28px", borderBottom: `1px solid ${F.gray6}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "#fff", position: "sticky", top: 0, zIndex: 50,
            boxShadow: "0 1px 0 rgba(0,0,0,0.05)"
          }}>
            <div style={{
              fontFamily: "'Barlow Condensed',sans-serif",
              fontSize: 20, fontWeight: 800, textTransform: "uppercase",
              letterSpacing: 0.5, color: F.charcoal
            }}>
              {navItems.find(n => n.id === view)?.label || "Dashboard"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {podeExecutar(perfil, "exportar") && <Btn variant="ghost" onClick={exportarRelatorio}>↓ Exportar Relatório</Btn>}
              {view === "areas" && podeExecutar(perfil, "criar") && <Btn onClick={() => openModal("area")}>+ Nova Área</Btn>}
              {view === "processos" && podeExecutar(perfil, "criar") && <Btn onClick={() => openModal("processo")}>+ Novo Processo</Btn>}
              {(view === "auditorias" || view === "dashboard") && podeExecutar(perfil, "auditar") && (
                <Btn onClick={() => {
                  if (areasAuditaveis.length === 0) { showToast("Cadastre ao menos uma área auditável.", "err"); return; }
                  setAudStep(1); setAudForm({ data: new Date().toISOString().split("T")[0] });
                  setChecklist([]); openModal("auditoria");
                }}>+ Nova Auditoria</Btn>
              )}
              {view === "planos" && podeExecutar(perfil, "criar") && <Btn onClick={() => openModal("plano")}>+ Novo Relatório</Btn>}
              {view === "ciclos" && (podeExecutar(perfil, "criar") || podeExecutar(perfil, "gerir-ciclos")) && <Btn onClick={() => openModal("ciclo")}>+ Novo Ciclo</Btn>}
              {view === "modulos" && podeExecutar(perfil, "gerir-modulos") && <Btn onClick={() => openModal("modulo", {})}>+ Nova Categoria</Btn>}
              {view === "comite" && (podeExecutar(perfil, "criar") || podeExecutar(perfil, "gerir-comite")) && <Btn onClick={() => openModal("membro")}>+ Adicionar Membro</Btn>}
              {view === "usuarios" && podeExecutar(perfil, "criar") && <Btn onClick={() => openModal("usuario")}>+ Novo Usuário</Btn>}
              <div style={{ position: "relative" }}>
                <div onClick={() => setNotifOpen(o => !o)} style={{
                  width: 34, height: 34, borderRadius: 7,
                  background: notifOpen ? F.redDim : F.offWhite,
                  border: `1.5px solid ${notifOpen ? F.redBorder : F.gray6}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", position: "relative", fontSize: 14, transition: "all 0.15s"
                }}>
                  🔔
                  {notificacoes.length > 0 && (
                    <div style={{
                      position: "absolute", top: -5, right: -5,
                      minWidth: 17, height: 17, background: F.red,
                      borderRadius: 20, border: "2px solid #fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 700, color: "#fff", padding: "0 3px"
                    }}>{notificacoes.length}</div>
                  )}
                </div>

                {notifOpen && (
                  <>
                    <div onClick={() => setNotifOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 150 }} />
                    <div style={{
                      position: "absolute", top: "calc(100% + 10px)", right: 0,
                      width: 340, background: "#fff", borderRadius: 10, zIndex: 160,
                      boxShadow: "0 8px 32px rgba(0,0,0,0.14)", border: `1px solid ${F.gray6}`,
                      overflow: "hidden"
                    }}>
                      <div style={{
                        padding: "13px 16px", borderBottom: `1px solid ${F.gray6}`,
                        display: "flex", alignItems: "center", justifyContent: "space-between"
                      }}>
                        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
                          Notificações {notificacoes.length > 0 && <span style={{ color: F.red }}>({notificacoes.length})</span>}
                        </div>
                        {notificacoes.length > 0 && (
                          <button onClick={marcarTodasLidas} style={{ fontSize: 11, color: F.red, background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "'Barlow',sans-serif" }}>
                            Marcar todas como lidas
                          </button>
                        )}
                      </div>

                      <div style={{ maxHeight: 360, overflowY: "auto" }}>
                        {notificacoes.length === 0 ? (
                          <div style={{ padding: "32px 20px", textAlign: "center" }}>
                            <div style={{ fontSize: 28, opacity: 0.2, marginBottom: 8 }}>🔔</div>
                            <div style={{ fontSize: 13, color: F.gray4 }}>Nenhuma notificação</div>
                          </div>
                        ) : notificacoes.map(n => (
                          <div key={n.key} style={{
                            padding: "12px 16px", borderBottom: `1px solid ${F.gray6}`,
                            display: "flex", gap: 12, alignItems: "flex-start"
                          }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
                              background: n.tipo === "aprovacao" ? F.amberDim : n.titulo === "Vence hoje!" ? F.redDim : F.amberDim,
                            }}>
                              {n.tipo === "aprovacao" ? "⏳" : "⏰"}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                                letterSpacing: 0.5, marginBottom: 2,
                                color: n.tipo === "novo" ? F.blue : n.titulo === "Vence hoje!" ? F.red : F.amber,
                                fontFamily: "'Barlow Condensed',sans-serif"
                              }}>{n.titulo}</div>
                              <div style={{ fontSize: 12.5, color: F.charcoal, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.desc}</div>
                              <div style={{ fontSize: 11, color: F.gray4, marginTop: 3 }}>
                                {n.area}{n.prazo ? ` · Prazo: ${fmtDate(n.prazo)}` : ""}
                              </div>
                            </div>
                            <button onClick={() => { setIdsLidos(s => new Set([...s, n.key])); if (n.dbId) upd("notificacoes", arr => arr.map(x => x.id === n.dbId ? { ...x, lida: true } : x)); }} style={{
                              background: "none", border: "none", color: F.gray4,
                              cursor: "pointer", fontSize: 14, padding: "2px 4px", flexShrink: 0
                            }}>✕</button>
                          </div>
                        ))}
                      </div>

                      {notificacoes.length > 0 && (
                        <div style={{ padding: "10px 16px", borderTop: `1px solid ${F.gray6}`, background: "#fafafa" }}>
                          <button onClick={() => { setView("planos"); setNotifOpen(false); }} style={{
                            fontSize: 12, color: F.red, background: "none", border: "none",
                            cursor: "pointer", fontWeight: 600, fontFamily: "'Barlow',sans-serif"
                          }}>Ver todos os relatórios de conclusão →</button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* CONTENT */}
          <div style={{ padding: "24px 28px", flex: 1 }}>

            {/* ── RESUMO DO GESTOR ── */}
            {perfil === "gestor" && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: F.gray4, marginBottom: 2 }}>Minha Área</div>
                    <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 900, color: F.charcoal }}>{usuarioLogado.areaNome}</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  <div style={{ background: "#fff", borderRadius: 10, padding: "16px 18px", border: `1px solid ${F.gray6}`, borderTop: `3px solid ${confGeral !== null ? scoreColor(confGeral) : F.blue}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: F.gray4, marginBottom: 8, fontFamily: "'Barlow Condensed',sans-serif" }}>Conformidade Geral</div>
                    <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 36, fontWeight: 900, color: confGeral !== null ? scoreColor(confGeral) : F.gray5, lineHeight: 1 }}>
                      {confGeral !== null ? `${confGeral}%` : "—"}
                    </div>
                    <div style={{ fontSize: 12, color: F.gray4, marginTop: 5 }}>{confGeral !== null ? scoreLabel(confGeral) : "Sem auditorias"}</div>
                  </div>
                  <div style={{ background: "#fff", borderRadius: 10, padding: "16px 18px", border: `1px solid ${F.gray6}`, borderTop: `3px solid ${F.red}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: F.gray4, marginBottom: 8, fontFamily: "'Barlow Condensed',sans-serif" }}>Auditorias Realizadas</div>
                    <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 36, fontWeight: 900, color: F.charcoal, lineHeight: 1 }}>
                      {audsConcluidas.length || "—"}
                    </div>
                    {audsConcluidas.length > 0 && (
                      <div style={{ fontSize: 12, color: F.gray4, marginTop: 5 }}>
                        Última: <strong style={{ color: scoreColor(audsConcluidas[audsConcluidas.length - 1].score) }}>{audsConcluidas[audsConcluidas.length - 1].score}%</strong>
                        {" · "}{fmtDate(audsConcluidas[audsConcluidas.length - 1].data)}
                      </div>
                    )}
                      {!audsConcluidas.length && <div style={{ fontSize: 12, color: F.gray4, marginTop: 5 }}>Nenhuma auditoria</div>}
                  </div>
                  <div style={{ background: "#fff", borderRadius: 10, padding: "16px 18px", border: `1px solid ${F.gray6}`, borderTop: `3px solid ${planosAtrasados.length > 0 ? F.red : F.amber}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: F.gray4, marginBottom: 8, fontFamily: "'Barlow Condensed',sans-serif" }}>Planos em Aberto</div>
                    <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 36, fontWeight: 900, color: planosAtrasados.length > 0 ? F.red : F.charcoal, lineHeight: 1 }}>
                      {planosPendentes.length || "—"}
                    </div>
                    <div style={{ fontSize: 12, color: planosAtrasados.length > 0 ? F.red : F.gray4, marginTop: 5, fontWeight: planosAtrasados.length > 0 ? 600 : 400 }}>
                      {planosAtrasados.length > 0 ? `${planosAtrasados.length} atrasado${planosAtrasados.length !== 1 ? "s" : ""}` : "Nenhum atrasado"}
                    </div>
                  </div>
                </div>

                {/* Auditorias aguardando ciência */}
                {(() => {
                  const pendentes = db.auditorias.filter(a =>
                    (a.areaId === usuarioLogado.areaId || a.areaNome === usuarioLogado.areaNome)
                    && !a.ciencia?.confirmado
                  );
                  if (!pendentes.length) return null;
                  return (
                    <div style={{ marginTop: 14, background: "#fff", border: `1.5px solid ${F.green}`, borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ padding: "12px 16px", background: F.greenDim, display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: F.green, flex: 1 }}>
                          ✔ Auditorias aguardando sua ciência ({pendentes.length})
                        </div>
                        <div style={{ fontSize: 11, color: F.green }}>Registre abaixo ou acesse Auditorias</div>
                      </div>
                      {pendentes.map((a, i) => (
                        <div key={a.id} style={{ padding: "11px 16px", borderTop: i > 0 ? `1px solid ${F.gray6}` : "none", display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: F.charcoal }}>{a.areaNome}</div>
                            <div style={{ fontSize: 11, color: F.gray4 }}>{fmtDate(a.data)} · {a.auditorNome} · <strong style={{ color: scoreColor(a.score) }}>{a.score}%</strong></div>
                          </div>
                          <button onClick={() => setCienciaAuditoriaId(a.id)} style={{ background: F.green, color: "#fff", border: "none", borderRadius: 7, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Barlow',sans-serif" }}>
                            Registrar Ciência
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ── DASHBOARD ── */}
            {view === "dashboard" && (
              <div>
                {/* Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 20 }}>
                  <StatCard label="Áreas Auditáveis" value={areasAuditaveis.length || "—"}
                    sub={areasAuditaveis.length ? `${areasAuditaveis.length} área${areasAuditaveis.length !== 1 ? "s" : ""}` : "Nenhuma cadastrada"}
                    accent={F.green} delay={0} />
                  <StatCard label="Auditorias Realizadas" value={audsConcluidas.length || "—"}
                    sub={audsConcluidas.length ? `${audsConcluidas.length} no total` : "Nenhuma realizada"}
                    accent={F.red} delay={0.05} />
                  <StatCard label="Planos em Andamento"
                    value={planosAprovados.filter(p => p.status === "andamento").length || "—"}
                    sub={planosAprovados.filter(p => p.status === "andamento").length ? `de ${planosAprovados.length} aprovado${planosAprovados.length !== 1 ? "s" : ""}` : "Nenhum em andamento"}
                    accent={F.blue} delay={0.08} />
                  <StatCard label="Ações em Atraso" value={db.planos.length ? planosAtrasados.length : "—"}
                    sub={db.planos.length ? `${db.planos.length} plano${db.planos.length !== 1 ? "s" : ""} no total` : "Nenhum plano"}
                    accent={planosAtrasados.length > 0 ? F.red : F.amber} delay={0.1} />
                  <StatCard label="Conformidade Geral"
                    value={confGeral !== null ? confGeral + "%" : "—"}
                    sub={confGeral !== null ? scoreLabel(confGeral) : "Sem dados de auditoria"}
                    accent={confGeral !== null ? scoreColor(confGeral) : F.blue} delay={0.15} />
                </div>

                {/* Gráficos */}
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 14 }}>
                  <Card className="anim2">
                    <div style={{
                      fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14,
                      fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5,
                      marginBottom: 16, color: F.charcoal
                    }}>Conformidade por Área</div>
                    {chartConf.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={chartConf} margin={{ top: 0, right: 0, bottom: 20, left: -20 }}>
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: F.gray4, fontFamily: "Barlow Condensed" }} angle={-30} textAnchor="end" />
                          <YAxis tick={{ fontSize: 10, fill: F.gray4 }} domain={[0, 100]} />
                          <Tooltip
                            contentStyle={{ background: F.charcoal, border: "none", borderRadius: 6, color: "#fff", fontSize: 12 }}
                            formatter={(v) => [v + "%", "Score"]}
                          />
                          <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                            {chartConf.map((c, i) => <Cell key={i} fill={c.fill} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
                        <div style={{ fontSize: 28, opacity: 0.15 }}>📊</div>
                        <div style={{ fontSize: 12.5, color: F.gray4 }}>Realize auditorias para visualizar</div>
                      </div>
                    )}
                  </Card>

                  <Card className="anim2">
                    <div style={{
                      fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14,
                      fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5,
                      marginBottom: 16, color: F.charcoal
                    }}>Relatórios de Conclusão</div>
                    {chartPlanos.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={chartPlanos} cx="50%" cy="45%" outerRadius={75} dataKey="value" label={({ name, value }) => `${value}`} labelLine={false}>
                            {chartPlanos.map((c, i) => <Cell key={i} fill={c.fill} />)}
                          </Pie>
                          <Legend iconSize={8} wrapperStyle={{ fontSize: 11, fontFamily: "Barlow" }} />
                          <Tooltip contentStyle={{ background: F.charcoal, border: "none", borderRadius: 6, color: "#fff", fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
                        <div style={{ fontSize: 28, opacity: 0.15 }}>✅</div>
                        <div style={{ fontSize: 12.5, color: F.gray4 }}>Nenhum plano cadastrado</div>
                      </div>
                    )}
                  </Card>
                </div>

                {/* Evolução + Tabela */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <Card className="anim3">
                    <div style={{
                      fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14,
                      fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5,
                      marginBottom: 16, color: F.charcoal
                    }}>Evolução de Score</div>
                    {chartEvolucao.length > 0 ? (
                      <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={chartEvolucao}>
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: F.gray4 }} />
                          <YAxis tick={{ fontSize: 10, fill: F.gray4 }} domain={[0, 100]} />
                          <Tooltip contentStyle={{ background: F.charcoal, border: "none", borderRadius: 6, color: "#fff", fontSize: 12 }} formatter={(v) => [v + "%", "Score"]} />
                          <Line type="monotone" dataKey="score" stroke={F.red} strokeWidth={2.5} dot={{ fill: F.red, r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
                        <div style={{ fontSize: 28, opacity: 0.15 }}>📈</div>
                        <div style={{ fontSize: 12.5, color: F.gray4 }}>Sem dados de evolução</div>
                      </div>
                    )}
                  </Card>

                  <Card className="anim3">
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "center", marginBottom: 14
                    }}>
                      <div style={{
                        fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14,
                        fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5
                      }}>Últimas Auditorias</div>
                      <button onClick={() => setView("auditorias")} style={{
                        fontSize: 11.5, color: F.red, background: "none",
                        border: "none", cursor: "pointer", fontFamily: "'Barlow',sans-serif", fontWeight: 600
                      }}>Ver todas →</button>
                    </div>
                    {auditoriasVisiveis.length > 0 ? (
                      <DataTable
                        cols={["Área", "Score", "Data"]}
                        rows={[...auditoriasVisiveis].reverse().slice(0, 5).map(a => (
                          <>
                            <TD><strong style={{ fontSize: 12.5 }}>{a.areaNome}</strong></TD>
                            <TD><strong style={{ color: scoreColor(a.score), fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15 }}>{a.score}%</strong></TD>
                            <TD style={{ color: F.gray4 }}>{fmtDate(a.data)}</TD>
                          </>
                        ))}
                        empty={{ icon: "📋", title: "Nenhuma auditoria" }}
                      />
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0", gap: 8 }}>
                        <div style={{ fontSize: 28, opacity: 0.15 }}>📋</div>
                        <div style={{ fontSize: 12.5, color: F.gray4 }}>Nenhuma auditoria realizada</div>
                      </div>
                    )}
                  </Card>
                </div>
              </div>
            )}

            {/* ── ÁREAS ── */}
            {view === "areas" && (
              <Card>
                <DataTable
                  cols={["Área", "Categoria", "Diretor", "Subáreas", "Status", ...(podeExecutar(perfil, "criar") || podeExecutar(perfil, "excluir") ? [""] : [])]}
                  rows={db.areas.map(a => (
                    <>
                      <TD><strong>{a.nome}</strong></TD>
                      <TD>{(a.categoria || a.grupo) ? <Tag>{a.categoria || a.grupo}</Tag> : "—"}</TD>
                      <TD style={{ color: F.gray3 }}>{a.diretor?.nome || a.resp || "—"}</TD>
                      <TD>{a.subareas?.length > 0 ? <Tag>{a.subareas.length} subárea{a.subareas.length !== 1 ? "s" : ""}</Tag> : "—"}</TD>
                      <TD>{(a.naoAuditada || a.noa) ? <Pill color={F.gray3} bg={F.gray6}>Não auditada</Pill> : <Pill color={F.green} bg={F.greenDim}>Ativa</Pill>}</TD>
                      {(podeExecutar(perfil, "criar") || podeExecutar(perfil, "excluir")) && (
                        <TD>
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            {podeExecutar(perfil, "criar") && (
                              <button onClick={() => openModal("area", a)} style={{ background: F.offWhite, border: `1px solid ${F.gray6}`, borderRadius: 5, color: F.gray3, cursor: "pointer", fontSize: 13, padding: "3px 8px" }}>✎</button>
                            )}
                            {podeExecutar(perfil, "excluir") && (
                              <button onClick={() => upd("areas", arr => arr.filter(x => x.id !== a.id))} style={{ background: "none", border: "none", color: F.gray4, cursor: "pointer", fontSize: 16, padding: "2px 6px" }}>✕</button>
                            )}
                          </div>
                        </TD>
                      )}
                    </>
                  ))}
                  empty={{
                    icon: "🏢", title: "Nenhuma área cadastrada",
                    sub: "Cadastre as áreas da Fast para organizar processos e auditorias.",
                    action: <Btn style={{ marginTop: 10 }} onClick={() => openModal("area")}>+ Cadastrar Primeira Área</Btn>
                  }}
                />
              </Card>
            )}

            {/* ── PROCESSOS ── */}
            {view === "processos" && (
              <Card>
                <DataTable
                  cols={["Processo", "Área", "Responsável", "Documento", "Status", ...(podeExecutar(perfil, "excluir") ? [""] : [])]}
                  rows={db.processos.map(p => {
                    const sm = { conforme: [F.green, F.greenDim, "Conforme"], revisao: [F.amber, F.amberDim, "Em Revisão"], pendente: [F.red, F.redDim, "Pendente"], inativo: [F.gray3, F.gray6, "Inativo"] };
                    const [c, bg, lbl] = sm[p.status] || [F.gray3, F.gray6, p.status];
                    return <>
                      <TD><strong>{p.nome}</strong></TD>
                      <TD style={{ color: F.gray3 }}>{p.areaNome}</TD>
                      <TD style={{ color: F.gray3 }}>{p.resp || "—"}</TD>
                      <TD>{p.link ? <a href={p.link} target="_blank" rel="noreferrer" style={{ color: F.red, fontSize: 12, fontWeight: 600 }}>↗ SharePoint</a> : "—"}</TD>
                      <TD><Pill color={c} bg={bg}>{lbl}</Pill></TD>
                      {podeExecutar(perfil, "excluir") && <TD><button onClick={() => upd("processos", arr => arr.filter(x => x.id !== p.id))} style={{ background: "none", border: "none", color: F.gray4, cursor: "pointer", fontSize: 16, padding: "2px 6px" }}>✕</button></TD>}
                    </>;
                  })}
                  empty={{
                    icon: "⬡", title: "Nenhum processo cadastrado",
                    sub: "Cadastre os processos com o link do documento no SharePoint.",
                    action: <Btn style={{ marginTop: 10 }} onClick={() => openModal("processo")}>+ Cadastrar Primeiro Processo</Btn>
                  }}
                />
              </Card>
            )}

            {/* ── AUDITORIAS ── */}
            {view === "auditorias" && (
              <Card>
                <DataTable
                  cols={["Área", "Auditor", "Data", "Ciclo", "Score Individual", "Média do Ciclo", "NCs", "Ciência", "Rel. Final", ...(podeExecutar(perfil, "excluir") ? [""] : [])]}
                  rows={auditoriasVisiveis.map(a => {
                    const ncc = a.ncs?.filter(n => n.clas === "nc").length || 0;
                    const parceirosCiclo = a.cicloNome && a.cicloNome !== "—"
                      ? db.auditorias.filter(x => x.areaId === a.areaId && x.cicloNome === a.cicloNome)
                      : [];
                    const mediaCiclo = parceirosCiclo.length > 1
                      ? Math.round(parceirosCiclo.reduce((s, x) => s + x.score, 0) / parceirosCiclo.length)
                      : null;
                    return <>
                      <TD><strong>{a.areaNome}</strong>{a.local && <div style={{ fontSize: 11, color: F.gray4 }}>{a.local}</div>}</TD>
                      <TD style={{ color: F.gray3 }}>{a.auditorNome}</TD>
                      <TD style={{ color: F.gray3 }}>{fmtDate(a.data)}</TD>
                      <TD>{a.cicloNome !== "—" ? <Tag>{a.cicloNome}</Tag> : "—"}</TD>
                      <TD>
                        <strong style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, color: scoreColor(a.score) }}>{a.score}%</strong>
                        {parceirosCiclo.length > 1 && <div style={{ fontSize: 10, color: F.gray4 }}>{parceirosCiclo.length} auditores</div>}
                      </TD>
                      <TD>
                        {mediaCiclo !== null
                          ? <><strong style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, color: scoreColor(mediaCiclo) }}>{mediaCiclo}%</strong><div style={{ fontSize: 10, color: F.gray4 }}>{scoreLabel(mediaCiclo)}</div></>
                          : <span style={{ color: F.gray4, fontSize: 12 }}>—</span>}
                      </TD>
                      <TD>{ncc > 0 ? <Tag color={F.red} bg={F.redDim}>{ncc} NC</Tag> : "—"}</TD>
                      <TD>
                        {a.ciencia?.confirmado
                          ? <div><Pill color={F.green} bg={F.greenDim}>Registrada</Pill><div style={{ fontSize: 10, color: F.gray4, marginTop: 2 }}>{a.ciencia.responsavel} · {fmtDate(a.ciencia.data)}</div></div>
                          : <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <Pill color={F.amber} bg={F.amberDim}>Pendente</Pill>
                              {perfil === "gestor" && <button onClick={() => setCienciaAuditoriaId(a.id)} style={{ fontSize: 10.5, color: F.green, background: F.greenDim, border: `1px solid ${F.green}44`, borderRadius: 5, padding: "2px 8px", cursor: "pointer", fontWeight: 700, fontFamily: "'Barlow',sans-serif" }}>Registrar</button>}
                            </div>
                        }
                      </TD>
                      <TD>
                        {podeExecutar(perfil, "relatorio-final") && (
                          a.relatorioFinal?.status === "enviado"
                            ? <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <Pill color={F.green} bg={F.greenDim}>Enviado</Pill>
                                <div style={{ fontSize: 10, color: F.gray4 }}>{a.relatorioFinal.auditorNome}</div>
                                <button onClick={() => setViewRelatorioAudId(a.id)} style={{ background: F.greenDim, color: F.green, border: `1px solid ${F.green}44`, borderRadius: 5, padding: "2px 8px", cursor: "pointer", fontSize: 10.5, fontWeight: 700, fontFamily: "'Barlow',sans-serif" }}>📄 Ver</button>
                              </div>
                            : <button onClick={() => setRelatorioFinalAudId(a.id)} style={{ fontSize: 11, color: F.blue, background: F.blueDim, border: `1px solid ${F.blue}44`, borderRadius: 5, padding: "3px 9px", cursor: "pointer", fontWeight: 700, fontFamily: "'Barlow',sans-serif" }}>Elaborar</button>
                        )}
                        {!podeExecutar(perfil, "relatorio-final") && (
                          a.relatorioFinal?.status === "enviado"
                            ? <button onClick={() => setViewRelatorioAudId(a.id)} style={{ background: F.greenDim, color: F.green, border: `1px solid ${F.green}44`, borderRadius: 5, padding: "3px 9px", cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "'Barlow',sans-serif" }}>📄 Ver Relatório</button>
                            : <span style={{ color: F.gray5, fontSize: 12 }}>—</span>
                        )}
                      </TD>
                      {podeExecutar(perfil, "excluir") && <TD><button onClick={() => upd("auditorias", arr => arr.filter(x => x.id !== a.id))} style={{ background: "none", border: "none", color: F.gray4, cursor: "pointer", fontSize: 16, padding: "2px 6px" }}>✕</button></TD>}
                    </>;
                  })}
                  empty={{
                    icon: "◎", title: "Nenhuma auditoria registrada",
                    sub: "Crie uma nova auditoria para iniciar o ciclo de avaliação.",
                    action: <Btn style={{ marginTop: 10 }} onClick={() => { if (areasAuditaveis.length === 0) { showToast("Cadastre ao menos uma área.", "err"); return; } setAudStep(1); setAudForm({ data: new Date().toISOString().split("T")[0] }); setChecklist([]); openModal("auditoria"); }}>+ Criar Primeira Auditoria</Btn>
                  }}
                />
              </Card>
            )}

            {/* ── ELABORAR PLANO DE AÇÃO ── */}
            {view === "elaborar" && (() => {
              const planosParaElaborar = db.planos.filter(p => p.aguardaComite && !p.enqueteEnviada);
              return (
                <div>
                  {planosParaElaborar.length === 0 ? (
                    <Card>
                      <div style={{ textAlign: "center", padding: "48px 20px" }}>
                        <div style={{ fontSize: 36, opacity: 0.15, marginBottom: 10 }}>✍</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: F.gray3, marginBottom: 6 }}>Nenhum plano aguardando elaboração</div>
                        <div style={{ fontSize: 13, color: F.gray4 }}>Os planos gerados por auditorias aparecerão aqui para elaboração.</div>
                      </div>
                    </Card>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ fontSize: 12.5, color: F.gray3, background: F.blueDim, border: `1px solid ${F.blue}33`, borderRadius: 8, padding: "10px 14px", lineHeight: 1.7 }}>
                        Elabore cada plano de ação com prazo e responsável definidos. Quando todos os campos estiverem preenchidos, o botão de envio para enquete do comitê será liberado.
                      </div>
                      {planosParaElaborar.map(p => {
                        const aud = db.auditorias.find(a => a.id === p.auditoriaId);
                        const cmap = { nc: [F.red, F.redDim, "NC"], mel: [F.blue, F.blueDim, "Melhoria"], obs: [F.gray3, F.gray6, "Obs"] };
                        const [cc, cbg, clbl] = cmap[p.clas] || [F.gray3, F.gray6, "—"];
                        const completo = p.desc?.trim() && p.prazo && p.respId && p.causaRaiz;
                        return (
                          <Card key={p.id} style={{ border: `1.5px solid ${completo ? F.green : F.amber}` }}>
                            {/* Cabeçalho */}
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
                              <Tag color={cc} bg={cbg}>{clbl}</Tag>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13.5, fontWeight: 700, color: F.charcoal, lineHeight: 1.4 }}>{p.desc}</div>
                                {aud && <div style={{ fontSize: 11, color: F.gray4, marginTop: 3 }}>Auditoria: {aud.areaNome} · {fmtDate(aud.data)} · {aud.auditorNome}</div>}
                                {p.causaRaiz && <div style={{ fontSize: 11, color: F.gray3, marginTop: 2 }}>Causa raiz: <strong>{p.causaRaiz}</strong></div>}
                                {p.evidencia && <div style={{ fontSize: 11, color: F.gray3, marginTop: 2 }}>Evidência: {p.evidencia}</div>}
                              </div>
                              <div style={{ flexShrink: 0 }}>
                                {completo
                                  ? <Pill color={F.green} bg={F.greenDim}>Pronto para envio</Pill>
                                  : <Pill color={F.amber} bg={F.amberDim}>Pendente</Pill>}
                              </div>
                            </div>

                            {/* Formulário de elaboração */}
                            <div style={{ background: F.offWhite, borderRadius: 8, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                              <FG label="Descrição detalhada do plano de ação *">
                                <textarea
                                  style={{ ...fi, resize: "vertical", minHeight: 70, textTransform: "uppercase" }}
                                  value={p.desc || ""}
                                  onChange={e => salvarElaboracao(p.id, { desc: e.target.value })}
                                  placeholder="Descreva detalhadamente o plano de ação..."
                                />
                              </FG>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                <FG label="Responsável *">
                                  <select style={{ ...fi, borderColor: !p.respId ? F.amber : F.gray6 }} value={p.respId || ""} onChange={e => { const u = db.usuarios.find(x => x.id === e.target.value); salvarElaboracao(p.id, { respId: u?.id || "", respNome: u?.nome || "" }); }}>
                                    <option value="">Selecione o responsável...</option>
                                    {db.usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                                  </select>
                                </FG>
                                <FG label="Prazo *">
                                  <input type="date" style={{ ...fi, borderColor: !p.prazo ? F.amber : F.gray6 }} value={p.prazo || ""} onChange={e => salvarElaboracao(p.id, { prazo: e.target.value })} />
                                </FG>
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                <FG label="Causa Raiz *">
                                  <select style={{ ...fi, borderColor: !p.causaRaiz ? F.amber : F.gray6 }} value={p.causaRaiz || ""} onChange={e => salvarElaboracao(p.id, { causaRaiz: e.target.value })}>
                                    <option value="">Selecione a causa raiz...</option>
                                    {CAUSAS_RAIZ.map(cr => <option key={cr} value={cr}>{cr}</option>)}
                                  </select>
                                </FG>
                                <FG label="Prioridade">
                                  <select style={fi} value={p.prio || "high"} onChange={e => salvarElaboracao(p.id, { prio: e.target.value })}>
                                    <option value="high">Alta</option>
                                    <option value="mid">Média</option>
                                    <option value="low">Baixa</option>
                                  </select>
                                </FG>
                              </div>
                            </div>

                            {/* Botão de envio */}
                            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
                              <button
                                onClick={() => completo && enviarParaEnqueteComite(p.id)}
                                disabled={!completo}
                                style={{
                                  background: completo ? F.green : F.gray6,
                                  color: completo ? "#fff" : F.gray4,
                                  border: "none", borderRadius: 8, padding: "10px 20px",
                                  fontSize: 13, fontWeight: 700, cursor: completo ? "pointer" : "not-allowed",
                                  fontFamily: "'Barlow',sans-serif", transition: "all 0.2s",
                                  display: "flex", alignItems: "center", gap: 8
                                }}
                              >
                                {completo ? "✓ Enviar para Enquete do Comitê" : "⏳ Preencha todos os campos para enviar"}
                              </button>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── PLANOS ── */}
            {view === "planos" && (
              <div>

                {/* ── CIÊNCIA PENDENTE (gestor) ── */}
                {perfil === "gestor" && (() => {
                  const pendentes = db.auditorias.filter(a =>
                    (a.areaId === usuarioLogado.areaId || a.areaNome === usuarioLogado.areaNome)
                    && !a.ciencia?.confirmado
                  );
                  if (!pendentes.length) return null;
                  return (
                    <Card style={{ marginBottom: 16, border: `2px solid ${F.green}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                        <div style={{ width: 32, height: 32, background: F.green, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#fff", flexShrink: 0 }}>✔</div>
                        <div>
                          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: F.green }}>
                            Sua área foi auditada — registre sua ciência
                          </div>
                          <div style={{ fontSize: 11.5, color: F.gray3, marginTop: 2 }}>
                            {pendentes.length} auditoria{pendentes.length !== 1 ? "s" : ""} aguardando confirmação de ciência
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {pendentes.map(a => {
                          const ncc = a.ncs?.filter(n => n.clas === "nc").length || 0;
                          return (
                            <div key={a.id} style={{ background: F.offWhite, borderRadius: 8, padding: "12px 14px", display: "flex", alignItems: "center", gap: 14 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: F.charcoal }}>{a.areaNome}</div>
                                <div style={{ fontSize: 11.5, color: F.gray4, marginTop: 2 }}>
                                  Auditado em {fmtDate(a.data)} por {a.auditorNome}
                                  {" · "}Score: <strong style={{ color: scoreColor(a.score) }}>{a.score}%</strong>
                                  {ncc > 0 && <span style={{ color: F.red }}>{" · "}{ncc} NC{ncc !== 1 ? "s" : ""}</span>}
                                </div>
                              </div>
                              <Btn onClick={() => setCienciaAuditoriaId(a.id)} style={{ background: F.green, border: "none", flexShrink: 0 }}>
                                ✔ Registrar Ciência
                              </Btn>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  );
                })()}

                {/* Pendentes de aprovação */}
                {planosPendAprov.length > 0 && (
                  <Card style={{ marginBottom: 16, border: `1.5px solid ${F.amber}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                      <div style={{ width: 28, height: 28, background: F.amberDim, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⏳</div>
                      <div>
                        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: F.amber }}>
                          Aguardando Aprovação do Administrador
                        </div>
                        <div style={{ fontSize: 11.5, color: F.gray3 }}>{planosPendAprov.length} relatório{planosPendAprov.length !== 1 ? "s" : ""} pendente{planosPendAprov.length !== 1 ? "s" : ""}</div>
                      </div>
                    </div>
                    <DataTable
                      cols={["Ação", "Área", "Responsável", "Prazo", "Clas.", "Causa Raiz", "Origem", ...(podeExecutar(perfil, "aprovar") ? ["Aprovar / Rejeitar"] : [])]}
                      rows={planosPendAprov.map(p => {
                        const cmap = { nc: [F.red, F.redDim, "NC"], mel: [F.blue, F.blueDim, "Melhoria"], obs: [F.gray3, F.gray6, "Obs"] };
                        const [cc, cbg, clbl] = cmap[p.clas] || [F.gray3, F.gray6, "—"];
                        const iniciais = p.respNome ? p.respNome.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase() : null;
                        return <>
                          <TD style={{ maxWidth: 220 }}><span style={{ fontSize: 12.5 }}>{p.desc}</span></TD>
                          <TD style={{ color: F.gray3 }}>{p.areaNome}</TD>
                          <TD>
                            {iniciais
                              ? <div style={{ display: "flex", alignItems: "center", gap: 7 }}><div style={{ width: 24, height: 24, background: F.red, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff" }}>{iniciais}</div><span style={{ fontSize: 12 }}>{p.respNome}</span></div>
                              : podeExecutar(perfil, "aprovar")
                                ? <select style={{ ...fi, fontSize: 11.5, padding: "4px 8px", borderColor: F.amber }} value={p.respId || ""} onChange={e => {
                                    const u = db.usuarios.find(x => x.id === e.target.value);
                                    upd("planos", arr => arr.map(x => x.id === p.id ? { ...x, respId: u?.id || "", respNome: u?.nome || "" } : x));
                                  }}>
                                    <option value="">Atribuir responsável...</option>
                                    {db.usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                                  </select>
                                : <span style={{ fontSize: 12, color: F.amber }}>⚠ Pendente</span>
                            }
                          </TD>
                          <TD style={{ color: F.gray3 }}>{fmtDate(p.prazo)}</TD>
                          <TD><Tag color={cc} bg={cbg}>{clbl}</Tag></TD>
                          <TD style={{ fontSize: 12, color: p.causaRaiz ? F.charcoal : F.gray5 }}>{p.causaRaiz || "—"}</TD>
                          <TD><Tag>{p.origem === "auditoria" ? "Auditoria" : "Manual"}</Tag></TD>
                          {podeExecutar(perfil, "aprovar") && (
                            <TD>
                              <div style={{ display: "flex", gap: 6 }}>
                                <Btn onClick={() => aprovarPlano(p.id)} style={{ padding: "5px 12px", fontSize: 12, background: F.green, color: "#fff", border: "none" }}>✓ Aprovar</Btn>
                                <Btn variant="danger" onClick={() => rejeitarPlano(p.id)} style={{ padding: "5px 12px", fontSize: 12 }}>✕ Rejeitar</Btn>
                              </div>
                            </TD>
                          )}
                        </>;
                      })}
                      empty={{ icon: "⏳", title: "" }}
                    />
                  </Card>
                )}

                {/* Planos aprovados e rejeitados */}
                <Card>
                  {planosAprovados.length === 0 && planosPendAprov.length === 0 ? null : (
                    <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: F.gray4, marginBottom: 12 }}>
                      Planos Aprovados
                    </div>
                  )}
                  <DataTable
                    cols={["Ação", "Área", "Responsável", "Prazo", "Clas.", "Causa Raiz", "Status", "", ...(podeExecutar(perfil, "excluir") ? [""] : [])]}
                    rows={[
                      ...planosAprovados.map(p => {
                        const at = isAtrasado(p);
                        const cmap = { nc: [F.red, F.redDim, "NC"], mel: [F.blue, F.blueDim, "Melhoria"], obs: [F.gray3, F.gray6, "Obs"] };
                        const [cc, cbg, clbl] = cmap[p.clas] || [F.gray3, F.gray6, "—"];
                        const temExtPendente = p.extensao?.status === "pendente";
                        const iniciais = p.respNome ? p.respNome.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase() : null;
                        return <>
                          <TD style={{ maxWidth: 200 }}>
                            <span style={{ fontSize: 12.5 }}>{p.desc}</span>
                            {p.origem === "auditoria" && <div style={{ fontSize: 10, color: F.gray4 }}>via auditoria</div>}
                            {!p.respId && <div style={{ fontSize: 10, color: F.amber, fontWeight: 700 }}>⚠ Responsável pendente</div>}
                            {temExtPendente && (podeExecutar(perfil, "aprovar") || perfil === "comite") && (
                              <div style={{ marginTop: 4, display: "flex", gap: 5 }}>
                                <Tag color={F.amber} bg={F.amberDim}>Extensão Pendente</Tag>
                                <button onClick={() => aprovarExtensao(p.id)} style={{ fontSize: 10, background: F.green, color: "#fff", border: "none", borderRadius: 4, padding: "1px 7px", cursor: "pointer", fontWeight: 700 }}>✓</button>
                                <button onClick={() => rejeitarExtensao(p.id)} style={{ fontSize: 10, background: F.red, color: "#fff", border: "none", borderRadius: 4, padding: "1px 7px", cursor: "pointer", fontWeight: 700 }}>✕</button>
                              </div>
                            )}
                            {temExtPendente && !podeExecutar(perfil, "aprovar") && perfil !== "comite" && <Tag color={F.amber} bg={F.amberDim}>Extensão Pendente</Tag>}
                          </TD>
                          <TD style={{ color: F.gray3 }}>{p.areaNome}</TD>
                          <TD>
                            {iniciais ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                <div style={{ width: 26, height: 26, background: F.red, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{iniciais}</div>
                                <span style={{ fontSize: 12.5, color: F.charcoal }}>{p.respNome}</span>
                              </div>
                            ) : <span style={{ fontSize: 12, color: F.gray4 }}>—</span>}
                          </TD>
                          <TD style={{ color: at ? F.red : F.charcoal }}>
                            {fmtDate(p.extensao?.status === "aprovada" ? p.prazo : p.prazo)}
                            {at && <div style={{ fontSize: 10, color: F.red, fontWeight: 600 }}>Atrasado</div>}
                          </TD>
                          <TD><Tag color={cc} bg={cbg}>{clbl}</Tag></TD>
                          <TD style={{ fontSize: 12, color: p.causaRaiz ? F.charcoal : F.gray5 }}>{p.causaRaiz || "—"}</TD>
                          <TD>
                            {podeExecutar(perfil, "atualizar-status") ? (
                              <select value={p.status} onChange={e => {
                                const ns = e.target.value;
                                const nomes = { aberto: "Aberto", andamento: "Em Andamento", concluido: "Concluído" };
                                const evt = { data: new Date().toISOString(), acao: `Status alterado para ${nomes[ns]}`, autor: usuarioLogado?.nome || "Sistema" };
                                upd("planos", arr => arr.map(x => x.id === p.id ? { ...x, status: ns, historico: [...(x.historico || []), evt] } : x));
                              }} style={{ background: F.offWhite, border: `1.5px solid ${F.gray6}`, borderRadius: 5, color: F.charcoal, fontSize: 12, padding: "3px 7px", cursor: "pointer", fontFamily: "'Barlow',sans-serif" }}>
                                <option value="aberto">Aberto</option>
                                <option value="andamento">Em Andamento</option>
                                <option value="concluido">Concluído</option>
                              </select>
                            ) : (
                              <span style={{ fontSize: 12, color: F.gray3 }}>{{ aberto: "Aberto", andamento: "Em Andamento", concluido: "Concluído" }[p.status]}</span>
                            )}
                          </TD>
                          <TD>
                            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                              {at && podeExecutar(perfil, "atualizar-status") && (
                                <button onClick={() => setJustificandoPlano(p)} style={{ fontSize: 10.5, color: F.amber, background: F.amberDim, border: `1px solid ${F.amber}44`, borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontWeight: 600, fontFamily: "'Barlow',sans-serif", whiteSpace: "nowrap" }}>Justificar Atraso</button>
                              )}
                              <button onClick={() => setHistoricoPlanId(p.id)} style={{ fontSize: 11, color: F.gray4, background: "none", border: "none", cursor: "pointer", fontFamily: "'Barlow',sans-serif" }}>⊙</button>
                            </div>
                          </TD>
                          {podeExecutar(perfil, "excluir") && <TD><button onClick={() => upd("planos", arr => arr.filter(x => x.id !== p.id))} style={{ background: "none", border: "none", color: F.gray4, cursor: "pointer", fontSize: 16, padding: "2px 6px" }}>✕</button></TD>}
                        </>;
                      }),
                      ...planosVisiveis.filter(p => p.aprovacao === "rejeitado").map(p => {
                        const cmap = { nc: [F.red, F.redDim, "NC"], mel: [F.blue, F.blueDim, "Melhoria"], obs: [F.gray3, F.gray6, "Obs"] };
                        const [cc, cbg, clbl] = cmap[p.clas] || [F.gray3, F.gray6, "—"];
                        return <>
                          <TD style={{ maxWidth: 200, opacity: 0.5 }}><span style={{ fontSize: 12.5, textDecoration: "line-through" }}>{p.desc}</span>{p.rejeitadoPor && <div style={{ fontSize: 10, color: F.gray4 }}>Rejeitado por {p.rejeitadoPor} · {fmtDate(p.rejeitadoEm?.split("T")[0])}</div>}</TD>
                          <TD style={{ color: F.gray4 }}>{p.areaNome}</TD>
                          <TD style={{ color: F.gray4 }}>{p.respNome || "—"}</TD>
                          <TD style={{ color: F.gray4 }}>{fmtDate(p.prazo)}</TD>
                          <TD><Tag color={cc} bg={cbg}>{clbl}</Tag></TD>
                          <TD><Pill color={F.red} bg={F.redDim}>Rejeitado</Pill></TD>
                          <TD><button onClick={() => setHistoricoPlanId(p.id)} style={{ fontSize: 11, color: F.gray4, background: "none", border: "none", cursor: "pointer" }}>⊙</button></TD>
                          {podeExecutar(perfil, "excluir") && <TD><button onClick={() => upd("planos", arr => arr.filter(x => x.id !== p.id))} style={{ background: "none", border: "none", color: F.gray4, cursor: "pointer", fontSize: 16, padding: "2px 6px" }}>✕</button></TD>}
                        </>;
                      })
                    ]}
                    empty={{
                      icon: "◷", title: "Nenhum relatório de conclusão",
                      sub: "Os planos são gerados pelas auditorias ou criados manualmente.",
                      action: <Btn style={{ marginTop: 10 }} onClick={() => openModal("plano")}>+ Criar Relatório Manual</Btn>
                    }}
                  />
                </Card>
              </div>
            )}

            {/* ── MÓDULOS ── */}
            {view === "modulos" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                {/* Módulo fixo — Verificação Geral */}
                <Card style={{ border: `1.5px solid ${F.gray6}`, opacity: 0.85 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>Verificação Geral</div>
                        <Tag>Fixo</Tag>
                      </div>
                      <div style={{ fontSize: 12, color: F.gray4, marginTop: 3 }}>{CL_BASE.length} perguntas · Incluído em todas as auditorias</div>
                    </div>
                    <button onClick={() => setExpandedModulos(s => { const n = new Set(s); n.has("base") ? n.delete("base") : n.add("base"); return n; })} style={{ fontSize: 11.5, color: F.red, background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "'Barlow',sans-serif" }}>
                      {expandedModulos.has("base") ? "Ocultar" : "Ver perguntas"}
                    </button>
                  </div>
                  {expandedModulos.has("base") && (
                    <div style={{ borderTop: `1px solid ${F.gray6}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                      {CL_BASE.map((q, i) => (
                        <div key={i} style={{ display: "flex", gap: 10, padding: "7px 10px", background: F.offWhite, borderRadius: 6, fontSize: 13, color: F.gray3 }}>
                          <span style={{ color: F.gray5, fontSize: 11, fontWeight: 700, minWidth: 18 }}>{i + 1}.</span>{q}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Módulos customizados */}
                {(db.modulos || []).length === 0 && (
                  <div style={{ background: "#fff", border: `1px solid ${F.gray6}`, borderRadius: 10, padding: "40px 20px", textAlign: "center" }}>
                    <div style={{ fontSize: 28, opacity: 0.18, marginBottom: 8 }}>⊞</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: F.gray3, marginBottom: 6 }}>Nenhuma categoria criada</div>
                    <div style={{ fontSize: 12.5, color: F.gray4, marginBottom: 16 }}>Crie categorias de avaliação para adicionar perguntas específicas por área.</div>
                    {podeExecutar(perfil, "gerir-modulos") && <Btn onClick={() => openModal("modulo", {})}>+ Criar Primeira Categoria</Btn>}
                  </div>
                )}

                {(db.modulos || []).map(m => {
                  const areasVinc = db.areas.filter(a => m.areaIds?.includes(a.id));
                  const expanded = expandedModulos.has(m.id);
                  return (
                    <Card key={m.id} style={{ border: `1.5px solid ${m.ativo ? F.gray6 : F.gray6}`, opacity: m.ativo ? 1 : 0.55 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>{m.nome}</div>
                            <Pill color={m.ativo ? F.green : F.gray3} bg={m.ativo ? F.greenDim : F.gray6}>{m.ativo ? "Ativo" : "Inativo"}</Pill>
                          </div>
                          {m.descricao && <div style={{ fontSize: 12, color: F.gray4, marginBottom: 6 }}>{m.descricao}</div>}
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                            <span style={{ fontSize: 11.5, color: F.gray4 }}>{m.perguntas?.length || 0} pergunta{m.perguntas?.length !== 1 ? "s" : ""}</span>
                            {areasVinc.length > 0 && <span style={{ fontSize: 11, color: F.gray5 }}>·</span>}
                            {areasVinc.map(a => <Tag key={a.id}>{a.nome}</Tag>)}
                            {areasVinc.length === 0 && <Tag color={F.amber} bg={F.amberDim}>Sem área vinculada</Tag>}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                          <button onClick={() => setExpandedModulos(s => { const n = new Set(s); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n; })} style={{ fontSize: 11.5, color: F.red, background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "'Barlow',sans-serif", padding: "4px 8px" }}>
                            {expanded ? "Ocultar" : "Ver perguntas"}
                          </button>
                          {podeExecutar(perfil, "gerir-modulos") && <>
                            <button onClick={() => openModal("modulo", m)} style={{ background: F.offWhite, border: `1px solid ${F.gray6}`, borderRadius: 5, padding: "5px 10px", fontSize: 12, cursor: "pointer", color: F.gray3 }}>✎</button>
                            <button onClick={() => upd("modulos", arr => arr.filter(x => x.id !== m.id))} style={{ background: "none", border: "none", color: F.gray4, cursor: "pointer", fontSize: 16, padding: "2px 6px" }}>✕</button>
                          </>}
                        </div>
                      </div>
                      {expanded && (
                        <div style={{ borderTop: `1px solid ${F.gray6}`, marginTop: 12, paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                          {(m.perguntas || []).map((p, i) => (
                            <div key={p.id} style={{ display: "flex", gap: 10, padding: "7px 10px", background: F.offWhite, borderRadius: 6, fontSize: 13, color: F.gray3 }}>
                              <span style={{ color: F.gray5, fontSize: 11, fontWeight: 700, minWidth: 18 }}>{i + 1}.</span>{p.texto}
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}

            {/* ── NCS ── */}
            {view === "ncs" && (
              <Card>
                <DataTable
                  cols={["Item", "Área", "Tipo", "Evidência", "Data"]}
                  rows={db.auditorias.flatMap(a => (a.ncs || []).map(n => {
                    const cmap = { nc: [F.red, F.redDim, "NC"], mel: [F.blue, F.blueDim, "Melhoria"], obs: [F.gray3, F.gray6, "Obs"] };
                    const [cc, cbg, lbl] = cmap[n.clas] || [F.gray3, F.gray6, "—"];
                    return <>
                      <TD>{n.q}</TD>
                      <TD style={{ color: F.gray3 }}>{a.areaNome}</TD>
                      <TD><Tag color={cc} bg={cbg}>{lbl}</Tag></TD>
                      <TD style={{ maxWidth: 200, fontSize: 12, color: n.evidencia ? F.charcoal : F.gray5 }}>
                        {n.evidencia ? (n.evidencia.startsWith("http") ? <a href={n.evidencia} target="_blank" rel="noreferrer" style={{ color: F.red, fontWeight: 600 }}>↗ Link</a> : n.evidencia) : "—"}
                      </TD>
                      <TD style={{ color: F.gray4 }}>{fmtDate(a.data)}</TD>
                    </>;
                  }))}
                  empty={{ icon: "⚑", title: "Nenhuma não conformidade", sub: "As NCs das auditorias aparecerão aqui." }}
                />
              </Card>
            )}

            {/* ── CICLOS ── */}
            {view === "ciclos" && (
              <Card>
                <DataTable
                  cols={["Ciclo", "Início", "Fim", "Auditorias", "Status", ...(podeExecutar(perfil, "excluir") ? [""] : [])]}
                  rows={db.ciclos.map(c => {
                    const n = db.auditorias.filter(a => a.cicloNome === c.nome).length;
                    return <>
                      <TD><strong>{c.nome}</strong></TD>
                      <TD style={{ color: F.gray3 }}>{fmtDate(c.ini)}</TD>
                      <TD style={{ color: F.gray3 }}>{fmtDate(c.fim)}</TD>
                      <TD><Tag>{n} auditoria{n !== 1 ? "s" : ""}</Tag></TD>
                      <TD><Pill color={c.status === "ativo" ? F.green : F.gray3} bg={c.status === "ativo" ? F.greenDim : F.gray6}>{c.status === "ativo" ? "Ativo" : "Encerrado"}</Pill></TD>
                      {(podeExecutar(perfil, "excluir") || podeExecutar(perfil, "gerir-ciclos")) && <TD><button onClick={() => upd("ciclos", arr => arr.filter(x => x.id !== c.id))} style={{ background: "none", border: "none", color: F.gray4, cursor: "pointer", fontSize: 16, padding: "2px 6px" }}>✕</button></TD>}
                    </>;
                  })}
                  empty={{
                    icon: "◈", title: "Nenhum ciclo criado",
                    sub: "Crie um ciclo para planejar as auditorias do período.",
                    action: <Btn style={{ marginTop: 10 }} onClick={() => openModal("ciclo")}>+ Criar Primeiro Ciclo</Btn>
                  }}
                />
              </Card>
            )}

            {/* ── COMITÊ ── */}
            {view === "comite" && (
              <div>
                {/* Tabs */}
                <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
                  {[["reunioes","Reuniões de Auditoria"],["enquetes","Enquetes"],["membros","Membros"]].map(([id, label]) => (
                    <button key={id} onClick={() => setComiteAba(id)} style={{
                      padding: "8px 18px", borderRadius: 7, border: "none", cursor: "pointer",
                      fontSize: 13, fontWeight: 600, fontFamily: "'Barlow',sans-serif",
                      background: comiteAba === id ? F.red : "#fff",
                      color: comiteAba === id ? "#fff" : F.gray3,
                      boxShadow: comiteAba === id ? "none" : `0 0 0 1.5px ${F.gray6}`,
                      transition: "all 0.15s"
                    }}>{label}</button>
                  ))}
                </div>

                {/* Aba: Reuniões */}
                {comiteAba === "reunioes" && (() => {
                  const audsPendentes = db.auditorias.filter(a => a.comite);
                  if (!audsPendentes.length) return (
                    <Card>
                      <div style={{ textAlign: "center", padding: "40px 0" }}>
                        <div style={{ fontSize: 32, opacity: 0.18, marginBottom: 8 }}>◐</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: F.gray3 }}>Nenhuma auditoria aguardando comitê</div>
                        <div style={{ fontSize: 12.5, color: F.gray4, marginTop: 4 }}>As auditorias finalizadas aparecerão aqui para revisão.</div>
                      </div>
                    </Card>
                  );
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {audsPendentes.map(a => {
                        const status = a.comite?.status || "aguardando";
                        const planosPend = db.planos.filter(p => p.auditoriaId === a.id);
                        return (
                          <Card key={a.id} style={{ border: `1.5px solid ${status === "realizada" ? F.green : status === "aguardando" && a.comite?.dataReuniao ? F.amber : F.gray6}` }}>
                            {/* Cabeçalho */}
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                  <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 900, color: F.charcoal }}>{a.areaNome}</div>
                                  <Pill color={status === "realizada" ? F.green : F.amber} bg={status === "realizada" ? F.greenDim : F.amberDim}>
                                    {status === "realizada" ? "Reunião Realizada" : a.comite?.dataReuniao ? "Reunião Agendada" : "Aguardando Agendamento"}
                                  </Pill>
                                </div>
                                <div style={{ fontSize: 12, color: F.gray4, marginTop: 4 }}>
                                  Auditado em {fmtDate(a.data)} por {a.auditorNome}
                                  {a.cicloNome !== "—" && ` · Ciclo: ${a.cicloNome}`}
                                  {a.local && ` · ${a.local}`}
                                </div>
                              </div>
                              <div style={{ textAlign: "center" }}>
                                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 40, fontWeight: 900, color: scoreColor(a.score), lineHeight: 1 }}>{a.score}%</div>
                                <div style={{ fontSize: 11, color: scoreColor(a.score), fontWeight: 700, textTransform: "uppercase" }}>{scoreLabel(a.score)}</div>
                              </div>
                            </div>

                            {/* Não Conformidades + Evidências */}
                            {a.ncs?.length > 0 && (
                              <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: F.gray4, marginBottom: 8, fontFamily: "'Barlow Condensed',sans-serif" }}>
                                  Não Conformidades e Evidências ({a.ncs.length})
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  {a.ncs.map((n, i) => {
                                    const cmap = { nc: [F.red, F.redDim, "NC"], mel: [F.blue, F.blueDim, "Melhoria"], obs: [F.gray3, F.gray6, "Obs"] };
                                    const [c, bg, lbl] = cmap[n.clas] || [F.gray3, F.gray6, "—"];
                                    return (
                                      <div key={i} style={{ background: bg, border: `1px solid ${c}33`, borderRadius: 7, padding: "10px 12px" }}>
                                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                                          <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 3, background: `${c}22`, color: c, fontFamily: "'Barlow Condensed',sans-serif", textTransform: "uppercase", whiteSpace: "nowrap", marginTop: 1 }}>{lbl}</span>
                                          <span style={{ fontSize: 13, color: F.charcoal, flex: 1, lineHeight: 1.5 }}>{n.q}</span>
                                        </div>
                                        {n.evidencia && (
                                          <div style={{ marginTop: 7, paddingTop: 7, borderTop: `1px solid ${c}22`, fontSize: 12, color: F.gray3 }}>
                                            <span style={{ fontWeight: 700, color: F.gray4 }}>Evidência: </span>
                                            {n.evidencia.startsWith("http") ? <a href={n.evidencia} target="_blank" rel="noreferrer" style={{ color: F.red, fontWeight: 600 }}>↗ Acessar documento</a> : n.evidencia}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Agendamento e ações */}
                            {status !== "realizada" && (
                              <div style={{ background: F.offWhite, borderRadius: 8, padding: "12px 14px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                                <div style={{ flex: 1, minWidth: 180 }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: F.gray4, marginBottom: 5, fontFamily: "'Barlow Condensed',sans-serif" }}>Data da Reunião do Comitê</div>
                                  {podeExecutar(perfil, "agendar-reuniao") ? (
                                    <input type="date" style={{ ...fi, fontSize: 12.5 }} value={a.comite?.dataReuniao || ""} onChange={e => marcarReuniaoComNotificacoes(a.id, e.target.value)} />
                                  ) : (
                                    <div style={{ fontSize: 13, fontWeight: 600, color: a.comite?.dataReuniao ? F.charcoal : F.gray4 }}>{a.comite?.dataReuniao ? fmtDate(a.comite.dataReuniao) : "Não agendada"}</div>
                                  )}
                                </div>
                                {podeExecutar(perfil, "agendar-reuniao") && a.comite?.dataReuniao && (
                                  <Btn onClick={() => marcarReuniaoRealizada(a.id, "")} style={{ background: F.amber, border: "none", color: "#fff" }}>✓ Reunião Realizada</Btn>
                                )}
                              </div>
                            )}

                            {/* Reunião realizada — liberar relatórios */}
                            {status === "realizada" && (
                              <div style={{ background: F.greenDim, border: `1px solid ${F.green}44`, borderRadius: 8, padding: "12px 14px" }}>
                                <div style={{ fontSize: 12, color: F.green, fontWeight: 700, marginBottom: 8 }}>
                                  ✓ Reunião realizada em {fmtDate(a.comite?.realizadaEm?.split("T")[0])}
                                </div>
                                {planosPend.length > 0 && podeExecutar(perfil, "liberar-relatorios") && (
                                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                                    <div style={{ fontSize: 12.5, color: F.gray3, flex: 1 }}>
                                      {planosPend.length} relatório{planosPend.length !== 1 ? "s" : ""} de conclusão aguardando liberação para o gestor da área.
                                    </div>
                                    <Btn onClick={() => liberarRelatoriosGestor(a.id)} style={{ background: F.green, border: "none", color: "#fff" }}>
                                      ▶ Liberar Relatórios para o Gestor
                                    </Btn>
                                  </div>
                                )}
                                {planosPend.length === 0 && (
                                  <div style={{ fontSize: 12, color: F.green }}>Todos os relatórios já foram liberados.</div>
                                )}
                              </div>
                            )}

                            {/* Relatório Final */}
                            {a.relatorioFinal?.status === "enviado" && (
                              <div style={{ marginTop: 12, background: F.blueDim, border: `1px solid ${F.blue}44`, borderRadius: 8, padding: "10px 14px" }}>
                                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: F.blue, fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 6 }}>Relatório Final — {a.relatorioFinal.auditorNome} · {fmtDate(a.relatorioFinal.data?.split("T")[0])}</div>
                                {a.relatorioFinal.conclusoes && <div style={{ fontSize: 12.5, marginBottom: 4 }}><strong>Conclusões:</strong> {a.relatorioFinal.conclusoes}</div>}
                                {a.relatorioFinal.recomendacoes && <div style={{ fontSize: 12.5, marginBottom: 4 }}><strong>Recomendações:</strong> {a.relatorioFinal.recomendacoes}</div>}
                                {a.relatorioFinal.observacoes && <div style={{ fontSize: 12.5 }}><strong>Obs.:</strong> {a.relatorioFinal.observacoes}</div>}
                              </div>
                            )}

                            {/* Comentários do Comitê */}
                            {podeExecutar(perfil, "comentar-auditoria") && (
                              <div style={{ marginTop: 12, borderTop: `1px solid ${F.gray6}`, paddingTop: 12 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: F.gray4, fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 8 }}>Comentários do Comitê</div>
                                {(a.comentarios || []).map(c => (
                                  <div key={c.id} style={{ background: F.offWhite, borderRadius: 6, padding: "8px 10px", marginBottom: 6 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: F.gray3, marginBottom: 2 }}>{c.usuarioNome} · {fmtDate(c.data?.split("T")[0])}</div>
                                    <div style={{ fontSize: 12.5, color: F.charcoal }}>{c.texto}</div>
                                  </div>
                                ))}
                                <ComentarioInline audId={a.id} onSave={addComentarioAuditoria} />
                              </div>
                            )}

                            {a.obs && <div style={{ marginTop: 12, fontSize: 12, color: F.gray3, borderTop: `1px solid ${F.gray6}`, paddingTop: 10 }}><strong>Obs. do auditor:</strong> {a.obs}</div>}
                          </Card>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Aba: Enquetes */}
                {comiteAba === "enquetes" && (() => {
                  const planosComEnquete = db.planos.filter(p => p.enqueteComite && !p.aguardaComite);
                  const meusPendentes = planosComEnquete.filter(p => p.enqueteComite[usuarioLogado.id] === null || p.enqueteComite[usuarioLogado.id] === undefined);
                  const planosVotados = planosComEnquete.filter(p => p.enqueteComite[usuarioLogado.id]?.voto);
                  return (
                    <div>
                      {meusPendentes.length > 0 && (
                        <Card style={{ marginBottom: 14, border: `1.5px solid ${F.amber}` }}>
                          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: F.amber, marginBottom: 12 }}>
                            Aguardando seu voto ({meusPendentes.length})
                          </div>
                          {meusPendentes.map(p => {
                            const votos = Object.values(p.enqueteComite || {}).filter(Boolean);
                            const sim = votos.filter(v => v.voto === "sim").length;
                            const nao = votos.filter(v => v.voto === "nao").length;
                            return (
                              <div key={p.id} style={{ background: F.offWhite, borderRadius: 8, padding: "12px 14px", marginBottom: 10 }}>
                                <div style={{ fontSize: 13.5, fontWeight: 700, color: F.charcoal, marginBottom: 4 }}>{p.desc}</div>
                                <div style={{ fontSize: 11, color: F.gray4, marginBottom: 10 }}>{p.areaNome} · {fmtDate(p.prazo)}</div>
                                <div style={{ fontSize: 11, color: F.gray3, marginBottom: 8 }}>Votos: <strong style={{ color: F.green }}>{sim} Sim</strong> · <strong style={{ color: F.red }}>{nao} Não</strong></div>
                                {podeExecutar(perfil, "votar-enquete") && (
                                  <div style={{ display: "flex", gap: 8 }}>
                                    <Btn onClick={() => votarEnquete(p.id, "sim")} style={{ background: F.green, border: "none", color: "#fff", flex: 1 }}>✓ Aprovar</Btn>
                                    <Btn variant="danger" onClick={() => votarEnquete(p.id, "nao")} style={{ flex: 1 }}>✕ Reprovar</Btn>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </Card>
                      )}
                      {planosVotados.length > 0 && (
                        <Card>
                          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: F.gray4, marginBottom: 10 }}>Meus votos anteriores</div>
                          {planosVotados.map(p => {
                            const meuVoto = p.enqueteComite[usuarioLogado.id];
                            return (
                              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${F.gray6}` }}>
                                <Pill color={meuVoto.voto === "sim" ? F.green : F.red} bg={meuVoto.voto === "sim" ? F.greenDim : F.redDim}>{meuVoto.voto === "sim" ? "Aprovei" : "Reprovei"}</Pill>
                                <span style={{ fontSize: 12.5, color: F.charcoal, flex: 1 }}>{p.desc}</span>
                                <span style={{ fontSize: 11, color: F.gray4 }}>{fmtDate(meuVoto.data?.split("T")[0])}</span>
                              </div>
                            );
                          })}
                        </Card>
                      )}
                      {!meusPendentes.length && !planosVotados.length && (
                        <Card><div style={{ textAlign: "center", padding: "40px 0", color: F.gray4, fontSize: 13 }}>Nenhuma enquete pendente.</div></Card>
                      )}
                    </div>
                  );
                })()}

                {/* Aba: Membros */}
                {comiteAba === "membros" && (
                  <Card>
                    <div style={{ fontSize: 12.5, color: F.gray3, background: F.redDim, border: `1px solid ${F.redBorder}`, borderRadius: 7, padding: "10px 14px", marginBottom: 16, lineHeight: 1.6 }}>
                      Um representante por área operacional. O representante da área auditada é excluído automaticamente — recebe acesso ao resultado após publicação oficial.
                    </div>
                    <DataTable
                      cols={["Membro", "Representa", ...(podeExecutar(perfil, "excluir") || podeExecutar(perfil, "gerir-comite") ? [""] : [])]}
                      rows={db.comite.map(m => <>
                        <TD><strong>{m.uNome}</strong></TD>
                        <TD style={{ color: F.gray3 }}>{m.aNome}</TD>
                        {(podeExecutar(perfil, "excluir") || podeExecutar(perfil, "gerir-comite")) && <TD><button onClick={() => upd("comite", arr => arr.filter(x => x.id !== m.id))} style={{ background: "none", border: "none", color: F.gray4, cursor: "pointer", fontSize: 16, padding: "2px 6px" }}>✕</button></TD>}
                      </>)}
                      empty={{ icon: "◐", title: "Nenhum membro cadastrado", sub: "Adicione os representantes de cada área ao comitê." }}
                    />
                  </Card>
                )}
              </div>
            )}

            {/* ── USUÁRIOS ── */}
            {view === "usuarios" && (
              <Card>
                <DataTable
                  cols={["Usuário", "E-mail", "Perfil", "Área", ...(podeExecutar(perfil, "excluir") ? [""] : [])]}
                  rows={db.usuarios.map(u => {
                    const pc = PERFIL_COR;
                    const pl = PERFIL_LABEL;
                    return <>
                      <TD>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <div style={{ width: 28, height: 28, background: F.red, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{u.ini}</div>
                          <strong>{u.nome}</strong>
                        </div>
                      </TD>
                      <TD style={{ color: F.gray3 }}>{u.email}</TD>
                      <TD><span style={{ fontSize: 12, fontWeight: 700, color: pc[u.perfil] || F.gray3, fontFamily: "'Barlow Condensed',sans-serif", textTransform: "uppercase", letterSpacing: 0.5 }}>{pl[u.perfil] || u.perfil}</span></TD>
                      <TD style={{ color: F.gray3 }}>{u.areaNome !== "—" ? u.areaNome : "—"}</TD>
                      {podeExecutar(perfil, "excluir") && <TD><button onClick={() => upd("usuarios", arr => arr.filter(x => x.id !== u.id))} style={{ background: "none", border: "none", color: F.gray4, cursor: "pointer", fontSize: 16, padding: "2px 6px" }}>✕</button></TD>}
                    </>;
                  })}
                  empty={{
                    icon: "○", title: "Nenhum usuário cadastrado",
                    sub: "Cadastre os usuários com seus perfis de acesso.",
                    action: <Btn style={{ marginTop: 10 }} onClick={() => openModal("usuario")}>+ Cadastrar Primeiro Usuário</Btn>
                  }}
                />
              </Card>
            )}

          </div>
        </main>
      </div>

      {/* ══════ MODAIS ══════ */}

      {/* MÓDULO */}
      <ModuloModal open={!!modals.modulo} onClose={() => closeModal("modulo")} areas={db.areas} processos={db.processos} modulo={modals.modulo} onSave={saveModulo} />

      {/* ÁREA */}
      <AreaModal open={!!modals.area} onClose={() => closeModal("area")} modulos={db.modulos} area={modals.area} onSave={saveArea} />

      {/* PROCESSO */}
      <ProcessoModal open={!!modals.processo} onClose={() => closeModal("processo")} areas={db.areas} onSave={saveProcesso} />

      {/* CICLO */}
      <CicloModal open={!!modals.ciclo} onClose={() => closeModal("ciclo")} onSave={saveCiclo} />

      {/* USUÁRIO */}
      <UsuarioModal open={!!modals.usuario} onClose={() => closeModal("usuario")} areas={db.areas} onSave={saveUsuario} />

      {/* MEMBRO */}
      <MembroModal open={!!modals.membro} onClose={() => closeModal("membro")} areas={db.areas} usuarios={db.usuarios} onSave={saveMembro} />

      {/* PLANO */}
      <PlanoModal open={!!modals.plano} onClose={() => closeModal("plano")} areas={db.areas} usuarios={db.usuarios} onSave={f => { savePlano(f); }} />

      {/* VISUALIZAR RELATÓRIO FINAL */}
      <RelatorioFinalViewModal
        open={!!viewRelatorioAudId}
        onClose={() => setViewRelatorioAudId(null)}
        auditoria={db.auditorias.find(a => a.id === viewRelatorioAudId) || null}
      />

      {/* RELATÓRIO FINAL */}
      <RelatorioFinalModal
        open={!!relatorioFinalAudId}
        onClose={() => setRelatorioFinalAudId(null)}
        auditoria={db.auditorias.find(a => a.id === relatorioFinalAudId) || null}
        onSave={salvarRelatorioFinal}
      />

      {/* CIÊNCIA DO AUDITADO */}
      <CienciaModal
        open={!!cienciaAuditoriaId}
        onClose={() => setCienciaAuditoriaId(null)}
        auditoria={db.auditorias.find(a => a.id === cienciaAuditoriaId) || null}
        usuarioLogado={usuarioLogado}
        onSave={f => {
          upd("auditorias", arr => arr.map(a => a.id === cienciaAuditoriaId ? {
            ...a, ciencia: { responsavel: usuarioLogado?.nome || "—", responsavelId: usuarioLogado?.id || "", data: f.data, observacoes: f.observacoes, confirmado: true }
          } : a));
          setCienciaAuditoriaId(null);
          showToast("Ciência registrada com sucesso!");
        }}
      />

      {/* JUSTIFICATIVA */}
      <JustificativaModal
        open={!!justificandoPlano}
        onClose={() => setJustificandoPlano(null)}
        plano={justificandoPlano}
        onSave={f => {
          const evt = { data: new Date().toISOString(), acao: `Extensão solicitada — novo prazo: ${fmtDate(f.novoPrazo)}`, autor: usuarioLogado?.nome || "Sistema" };
          upd("planos", arr => arr.map(p => p.id === justificandoPlano.id ? { ...p, extensao: { motivo: f.motivo, novoPrazo: f.novoPrazo, solicitadoEm: new Date().toISOString(), status: "pendente" }, historico: [...(p.historico || []), evt] } : p));
          setJustificandoPlano(null);
          showToast("Extensão solicitada!");
        }}
      />

      {/* HISTÓRICO */}
      <HistoricoModal
        open={!!historicoPlanId}
        onClose={() => setHistoricoPlanId(null)}
        plano={db.planos.find(p => p.id === historicoPlanId) || null}
      />

      {/* AUDITORIA */}
      <AuditoriaModal
        open={!!modals.auditoria} onClose={() => { closeModal("auditoria"); setAudStep(1); }}
        step={audStep} setStep={setAudStep}
        form={audForm} setForm={setAudForm}
        checklist={checklist} setChecklist={setChecklist}
        areas={db.areas.filter(a => !a.naoAuditada && !a.noa)}
        usuarios={db.usuarios}
        ciclos={db.ciclos}
        modulos={db.modulos}
        buildChecklist={buildChecklist}
        calcScore={calcScore}
        onFinalizar={finalizarAuditoria}
      />

      {/* TOAST */}
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// MODAL COMPONENTS
// ══════════════════════════════════════════════════════════════════

function AreaModal({ open, onClose, modulos, area, onSave }) {
  const emptyF = { nome: "", categoria: "", diretor: { nome: "", email: "" }, blocoPerguntas: [], naoAuditada: false, subareas: [] };
  const [f, setF] = useState(emptyF);
  const isEdit = !!(area && area.id);

  useEffect(() => {
    if (open) setF(isEdit ? { ...emptyF, ...area, diretor: area.diretor || { nome: area.resp || "", email: "" }, blocoPerguntas: area.blocoPerguntas || [], subareas: area.subareas || [], naoAuditada: area.naoAuditada || area.noa || false } : emptyF);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function addSubarea() {
    setF(x => ({ ...x, subareas: [...x.subareas, { id: uid(), nome: "", responsaveis: [] }] }));
  }
  function removeSubarea(sid) { setF(x => ({ ...x, subareas: x.subareas.filter(s => s.id !== sid) })); }
  function updSubarea(sid, val) { setF(x => ({ ...x, subareas: x.subareas.map(s => s.id === sid ? { ...s, nome: val } : s) })); }
  function addResp(sid) {
    setF(x => ({ ...x, subareas: x.subareas.map(s => s.id === sid ? { ...s, responsaveis: [...s.responsaveis, { id: uid(), nome: "", email: "", cargo: "" }] } : s) }));
  }
  function removeResp(sid, rid) {
    setF(x => ({ ...x, subareas: x.subareas.map(s => s.id === sid ? { ...s, responsaveis: s.responsaveis.filter(r => r.id !== rid) } : s) }));
  }
  function updResp(sid, rid, campo, val) {
    setF(x => ({ ...x, subareas: x.subareas.map(s => s.id === sid ? { ...s, responsaveis: s.responsaveis.map(r => r.id === rid ? { ...r, [campo]: val } : r) } : s) }));
  }
  function toggleBloco(mid) {
    setF(x => ({ ...x, blocoPerguntas: x.blocoPerguntas.includes(mid) ? x.blocoPerguntas.filter(id => id !== mid) : [...x.blocoPerguntas, mid] }));
  }

  function save() {
    if (!f.nome?.trim()) { alert("Informe o nome da área."); return; }
    onSave(f); setF(emptyF);
  }

  const categOptions = ["Administrativo","Setor Técnico","Comercial Varejo","Comercial Atacado","Comercial Homes e Obras","Faturamento","Indústria","Franquias","Financeiro / Admin","Operações","Suporte","Controle"];
  const cargoOptions = [["gerente","Gerente"],["supervisor","Supervisor"],["coordenador","Coordenador"],["analista","Analista"],["operador","Operador"]];
  const modulosAtivos = (modulos || []).filter(m => m.ativo);

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Editar Área" : "Nova Área"} width={620}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={save}>{isEdit ? "Salvar Alterações" : "Salvar Área"}</Btn></>}>

      <FG label="Nome da Área">
        <input style={fi} value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} placeholder="ex: Comercial Varejo" />
      </FG>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <FG label="Categoria">
          <select style={fi} value={f.categoria} onChange={e => setF({ ...f, categoria: e.target.value })}>
            <option value="">Selecione...</option>
            {categOptions.map(g => <option key={g}>{g}</option>)}
          </select>
        </FG>
        <FG label="Configuração">
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", paddingTop: 9 }}>
            <input type="checkbox" checked={f.naoAuditada} onChange={e => setF({ ...f, naoAuditada: e.target.checked })} style={{ accentColor: F.red, width: 14, height: 14 }} />
            Excluir de auditorias
          </label>
        </FG>
      </div>

      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: F.gray4, marginBottom: 8 }}>Diretor da Área</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <FG label="Nome"><input style={fi} value={f.diretor.nome} onChange={e => setF({ ...f, diretor: { ...f.diretor, nome: e.target.value } })} placeholder="Nome do diretor" /></FG>
        <FG label="E-mail"><input type="email" style={{ ...fi, textTransform: "none" }} value={f.diretor.email} onChange={e => setF({ ...f, diretor: { ...f.diretor, email: e.target.value } })} placeholder="email@fast.com.br" /></FG>
      </div>

      {modulosAtivos.length > 0 && (
        <FG label="Categorias de Avaliação">
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {modulosAtivos.map(m => (
              <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={f.blocoPerguntas.includes(m.id)} onChange={() => toggleBloco(m.id)} style={{ accentColor: F.red, width: 14, height: 14 }} />
                {m.nome} <span style={{ fontSize: 11, color: F.gray4 }}>({m.perguntas?.length || 0} perguntas)</span>
              </label>
            ))}
          </div>
        </FG>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, marginTop: 4 }}>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: F.gray4 }}>Subáreas</div>
        <button onClick={addSubarea} style={{ fontSize: 11.5, color: F.red, background: "none", border: `1px dashed ${F.redBorder}`, borderRadius: 5, padding: "3px 10px", cursor: "pointer", fontWeight: 600, fontFamily: "'Barlow',sans-serif" }}>+ Adicionar Subárea</button>
      </div>
      {f.subareas.length === 0 && <div style={{ fontSize: 12, color: F.gray4, marginBottom: 4 }}>Nenhuma subárea adicionada.</div>}
      {f.subareas.map(s => (
        <div key={s.id} style={{ background: F.offWhite, borderRadius: 8, padding: 12, marginBottom: 10, border: `1px solid ${F.gray6}` }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
            <input style={{ ...fi, flex: 1 }} value={s.nome} onChange={e => updSubarea(s.id, e.target.value)} placeholder="Nome da subárea..." />
            <button onClick={() => removeSubarea(s.id)} style={{ background: "none", border: "none", color: F.gray4, cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: F.gray4, textTransform: "uppercase", letterSpacing: 1, marginBottom: 7, fontFamily: "'Barlow Condensed',sans-serif" }}>Responsáveis</div>
          {s.responsaveis.map(r => (
            <div key={r.id} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr auto", gap: 6, marginBottom: 6, alignItems: "center" }}>
              <input style={fi} value={r.nome} onChange={e => updResp(s.id, r.id, "nome", e.target.value)} placeholder="Nome" />
              <input type="email" style={{ ...fi, textTransform: "none" }} value={r.email} onChange={e => updResp(s.id, r.id, "email", e.target.value)} placeholder="email@fast.com.br" />
              <select style={fi} value={r.cargo} onChange={e => updResp(s.id, r.id, "cargo", e.target.value)}>
                <option value="">Cargo</option>
                {cargoOptions.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <button onClick={() => removeResp(s.id, r.id)} style={{ background: "none", border: "none", color: F.gray4, cursor: "pointer", fontSize: 15 }}>✕</button>
            </div>
          ))}
          <button onClick={() => addResp(s.id)} style={{ fontSize: 11.5, color: F.gray3, background: "none", border: `1px dashed ${F.gray5}`, borderRadius: 5, padding: "3px 10px", cursor: "pointer", fontFamily: "'Barlow',sans-serif", marginTop: 4 }}>+ Adicionar Responsável</button>
        </div>
      ))}
    </Modal>
  );
}

function ProcessoModal({ open, onClose, areas, onSave }) {
  const [f, setF] = useState({ nome: "", areaId: "", resp: "", link: "", status: "conforme" });
  function save() { onSave(f); setF({ nome: "", areaId: "", resp: "", link: "", status: "conforme" }); }
  return (
    <Modal open={open} onClose={onClose} title="Novo Processo" width={500}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={save}>Salvar</Btn></>}>
      <FG label="Nome do Processo"><input style={fi} value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} placeholder="ex: Recebimento de Materiais" /></FG>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <FG label="Área">
          <select style={fi} value={f.areaId} onChange={e => setF({ ...f, areaId: e.target.value })}>
            <option value="">Selecione...</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </FG>
        <FG label="Responsável"><input style={fi} value={f.resp} onChange={e => setF({ ...f, resp: e.target.value })} placeholder="Nome" /></FG>
      </div>
      <FG label="Link SharePoint"><input style={{ ...fi, textTransform: "none" }} value={f.link} onChange={e => setF({ ...f, link: e.target.value })} placeholder="https://..." /></FG>
      <FG label="Status">
        <select style={fi} value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>
          <option value="conforme">Conforme</option>
          <option value="revisao">Em Revisão</option>
          <option value="pendente">Pendente</option>
          <option value="inativo">Inativo</option>
        </select>
      </FG>
    </Modal>
  );
}

function CicloModal({ open, onClose, onSave }) {
  const [f, setF] = useState({ nome: "", ini: "", fim: "", obs: "" });
  function save() { onSave(f); setF({ nome: "", ini: "", fim: "", obs: "" }); }
  return (
    <Modal open={open} onClose={onClose} title="Novo Ciclo" width={480}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={save}>Criar Ciclo</Btn></>}>
      <FG label="Nome do Ciclo"><input style={fi} value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} placeholder="ex: Mai/2025" /></FG>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <FG label="Início"><input type="date" style={fi} value={f.ini} onChange={e => setF({ ...f, ini: e.target.value })} /></FG>
        <FG label="Fim"><input type="date" style={fi} value={f.fim} onChange={e => setF({ ...f, fim: e.target.value })} /></FG>
      </div>
      <FG label="Observações"><textarea style={{ ...fi, resize: "vertical", minHeight: 70 }} value={f.obs} onChange={e => setF({ ...f, obs: e.target.value })} placeholder="Observações..." /></FG>
    </Modal>
  );
}

function UsuarioModal({ open, onClose, areas, onSave }) {
  const [f, setF] = useState({ nome: "", ini: "", email: "", perfil: "administrador", areaId: "" });
  function save() { onSave(f); setF({ nome: "", ini: "", email: "", perfil: "administrador", areaId: "" }); }
  return (
    <Modal open={open} onClose={onClose} title="Novo Usuário" width={500}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={save}>Salvar</Btn></>}>
      <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 12 }}>
        <FG label="Nome"><input style={fi} value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} placeholder="Nome completo" /></FG>
        <FG label="Iniciais"><input style={fi} value={f.ini} onChange={e => setF({ ...f, ini: e.target.value })} placeholder="RB" maxLength={3} /></FG>
      </div>
      <FG label="E-mail Microsoft 365"><input type="email" style={fi} value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="nome@fast.com.br" /></FG>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <FG label="Perfil">
          <select style={fi} value={f.perfil} onChange={e => setF({ ...f, perfil: e.target.value })}>
            {[["administrador","Administrador"],["auditor-lider","Auditor Líder"],["auditor","Auditor"],["comite","Comitê"],["gestor","Gestor de Área"],["diretoria","Diretoria"],["operacional","Operacional"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </FG>
        <FG label="Área">
          <select style={fi} value={f.areaId} onChange={e => setF({ ...f, areaId: e.target.value })}>
            <option value="">Sem área</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </FG>
      </div>
    </Modal>
  );
}

function MembroModal({ open, onClose, areas, usuarios, onSave }) {
  const [f, setF] = useState({ usuarioId: "", areaId: "" });
  function save() { onSave(f); setF({ usuarioId: "", areaId: "" }); }
  return (
    <Modal open={open} onClose={onClose} title="Adicionar ao Comitê" width={480}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={save}>Adicionar</Btn></>}>
      <FG label="Usuário">
        <select style={fi} value={f.usuarioId} onChange={e => setF({ ...f, usuarioId: e.target.value })}>
          <option value="">Selecione...</option>
          {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
      </FG>
      <FG label="Área que representa">
        <select style={fi} value={f.areaId} onChange={e => setF({ ...f, areaId: e.target.value })}>
          <option value="">Selecione...</option>
          {areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </select>
      </FG>
      <div style={{ fontSize: 12, color: F.gray3, background: F.redDim, border: `1px solid ${F.redBorder}`, borderRadius: 7, padding: "9px 12px", marginTop: 8, lineHeight: 1.6 }}>
        Este membro será excluído automaticamente das auditorias da área que representa.
      </div>
    </Modal>
  );
}

function PlanoModal({ open, onClose, areas, usuarios, onSave }) {
  const empty = { desc: "", areaId: "", respId: "", respNome: "", prio: "high", prazo: "", clas: "nc", causaRaiz: "" };
  const [f, setF] = useState(empty);
  function save() {
    const area = areas.find(a => a.id === f.areaId);
    const resp = usuarios.find(u => u.id === f.respId);
    onSave({ ...f, areaNome: area?.nome || "—", respNome: resp?.nome || f.respNome });
    setF(empty);
  }
  return (
    <Modal open={open} onClose={onClose} title="Novo Relatório de Conclusão" width={500}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={save}>Criar Relatório</Btn></>}>
      <FG label="Descrição da Ação"><textarea style={{ ...fi, resize: "vertical", minHeight: 70 }} value={f.desc} onChange={e => setF({ ...f, desc: e.target.value })} placeholder="Descreva a ação..." /></FG>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <FG label="Área">
          <select style={fi} value={f.areaId} onChange={e => setF({ ...f, areaId: e.target.value })}>
            <option value="">Selecione...</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </FG>
        <FG label="Responsável *">
          <select style={{ ...fi, borderColor: !f.respId ? F.amber : F.gray6 }} value={f.respId} onChange={e => setF({ ...f, respId: e.target.value })}>
            <option value="">Selecione o responsável...</option>
            {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </FG>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <FG label="Prioridade">
          <select style={fi} value={f.prio} onChange={e => setF({ ...f, prio: e.target.value })}>
            <option value="high">Alta</option><option value="mid">Média</option><option value="low">Baixa</option>
          </select>
        </FG>
        <FG label="Prazo"><input type="date" style={fi} value={f.prazo} onChange={e => setF({ ...f, prazo: e.target.value })} /></FG>
        <FG label="Classificação">
          <select style={fi} value={f.clas} onChange={e => setF({ ...f, clas: e.target.value })}>
            <option value="nc">Não Conformidade</option><option value="mel">Melhoria</option><option value="obs">Observação</option>
          </select>
        </FG>
      </div>
      <FG label="Causa Raiz *">
        <select style={{ ...fi, borderColor: !f.causaRaiz ? F.amber : F.gray6, borderWidth: 2 }} value={f.causaRaiz} onChange={e => setF({ ...f, causaRaiz: e.target.value })}>
          <option value="">Selecione a causa raiz...</option>
          {CAUSAS_RAIZ.map(cr => <option key={cr} value={cr}>{cr}</option>)}
        </select>
        {!f.causaRaiz && <div style={{ fontSize: 10.5, color: F.amber, fontWeight: 700, marginTop: 4 }}>Campo obrigatório — identifique a origem do problema</div>}
      </FG>
    </Modal>
  );
}

async function gerarPDFRelatorioFinal(auditoria) {
  const r = auditoria.relatorioFinal;
  let logoSrc = "";
  try {
    const resp = await fetch("/logo-fast-sistemas-construtivos.svg");
    const svgText = await resp.text();
    logoSrc = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgText)))}`;
  } catch {}

  const scoreClr = s => s >= 85 ? "#00B050" : s >= 65 ? "#FF8C00" : "#E8001D";
  const scoreLbl = s => s >= 90 ? "Excelente" : s >= 75 ? "Conforme" : s >= 60 ? "Em Atenção" : "Crítico";
  const ncc = auditoria.ncs?.filter(n => n.clas === "nc").length || 0;
  const mel = auditoria.ncs?.filter(n => n.clas === "mel").length || 0;
  const obs = auditoria.ncs?.filter(n => n.clas === "obs").length || 0;

  const secao = (titulo, conteudo) => conteudo ? `
    <div class="secao">
      <div class="sec-titulo">${titulo}</div>
      <div class="sec-corpo">${conteudo}</div>
    </div>` : "";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Relatório Final — ${auditoria.areaNome}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #1A1A1A; background: #fff; padding: 40px; }
  @media print { body { padding: 20px; } .no-print { display:none; } }
  .header { display:flex; align-items:center; justify-content:space-between; border-bottom: 3px solid #E8001D; padding-bottom: 18px; margin-bottom: 28px; }
  .header img { height: 48px; }
  .header-right { text-align:right; color:#888; font-size:12px; line-height:1.8; }
  .titulo-doc { font-size: 22px; font-weight: 900; font-family: Arial Black, sans-serif; color: #1A1A1A; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px; }
  .resumo { display:flex; gap:16px; background:#F5F4F2; border-radius:10px; padding:20px; margin-bottom:28px; flex-wrap:wrap; }
  .resumo-bloco { flex:1; min-width:120px; }
  .resumo-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#888; margin-bottom:6px; }
  .resumo-valor { font-size:32px; font-weight:900; line-height:1; }
  .resumo-sub { font-size:11px; margin-top:4px; }
  .ncs-grid { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:28px; }
  .nc-box { flex:1; min-width:100px; border-radius:8px; padding:14px; text-align:center; }
  .nc-box-num { font-size:28px; font-weight:900; line-height:1; }
  .nc-box-lbl { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-top:4px; }
  .secao { margin-bottom:22px; }
  .sec-titulo { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#888; margin-bottom:8px; border-bottom:2px solid #E5E5E5; padding-bottom:5px; }
  .sec-corpo { font-size:13.5px; line-height:1.8; color:#1A1A1A; background:#F5F4F2; border-radius:8px; padding:14px 16px; white-space:pre-wrap; }
  .ncs-lista { margin-bottom:28px; }
  .nc-item { padding:10px 14px; border-radius:7px; margin-bottom:8px; }
  .nc-tag { display:inline-block; font-size:9px; font-weight:700; text-transform:uppercase; padding:2px 7px; border-radius:3px; margin-right:8px; }
  .evidencia { font-size:11.5px; margin-top:6px; color:#555; }
  .elaborador { font-size:11.5px; color:#888; margin-bottom:22px; padding:10px 14px; background:#F5F4F2; border-radius:7px; }
  .footer { margin-top:40px; padding-top:14px; border-top:1px solid #E5E5E5; font-size:11px; color:#aaa; text-align:center; }
  .print-btn { position:fixed; bottom:24px; right:24px; background:#E8001D; color:#fff; border:none; padding:11px 22px; border-radius:7px; font-size:13px; font-weight:700; cursor:pointer; box-shadow:0 4px 16px rgba(232,0,29,0.35); }
  .reuniao-box { background:#FFF3CD; border:1px solid #FFC107; border-radius:8px; padding:14px 16px; margin-bottom:22px; font-size:13px; color:#856404; }
</style>
</head>
<body>
<div class="header">
  ${logoSrc ? `<img src="${logoSrc}" alt="Fast Sistemas Construtivos"/>` : `<strong style="font-size:24px">FAST</strong>`}
  <div class="header-right">
    <div class="titulo-doc">Relatório Final de Auditoria</div>
    <div>Emitido em ${new Date().toLocaleDateString("pt-BR", { day:"2-digit", month:"long", year:"numeric" })}</div>
  </div>
</div>

${auditoria.comite?.dataReuniao ? `<div class="reuniao-box">📅 <strong>Reunião do Comitê agendada para ${new Date(auditoria.comite.dataReuniao + "T00:00").toLocaleDateString("pt-BR", { day:"2-digit", month:"long", year:"numeric" })}</strong></div>` : ""}

<div class="resumo">
  <div class="resumo-bloco">
    <div class="resumo-label">Área Auditada</div>
    <div style="font-size:18px; font-weight:800; margin-top:4px">${auditoria.areaNome}</div>
    <div class="resumo-sub" style="color:#888">${auditoria.cicloNome && auditoria.cicloNome !== "—" ? `Ciclo: ${auditoria.cicloNome}` : ""} ${auditoria.local ? `· ${auditoria.local}` : ""}</div>
  </div>
  <div class="resumo-bloco" style="text-align:center">
    <div class="resumo-label">Score</div>
    <div class="resumo-valor" style="color:${scoreClr(auditoria.score)}">${auditoria.score}%</div>
    <div class="resumo-sub" style="color:${scoreClr(auditoria.score)};font-weight:700">${scoreLbl(auditoria.score)}</div>
  </div>
  <div class="resumo-bloco" style="text-align:center">
    <div class="resumo-label">Data</div>
    <div style="font-size:15px;font-weight:700;margin-top:4px">${new Date(auditoria.data + "T00:00").toLocaleDateString("pt-BR")}</div>
    <div class="resumo-sub" style="color:#888">${auditoria.auditorNome}</div>
  </div>
</div>

<div class="ncs-grid">
  <div class="nc-box" style="background:#FFEBEB;border:1px solid #E8001D33">
    <div class="nc-box-num" style="color:#E8001D">${ncc}</div>
    <div class="nc-box-lbl" style="color:#E8001D">Não Conformidades</div>
  </div>
  <div class="nc-box" style="background:#E8F4FF;border:1px solid #0066CC33">
    <div class="nc-box-num" style="color:#0066CC">${mel}</div>
    <div class="nc-box-lbl" style="color:#0066CC">Oportunidades de Melhoria</div>
  </div>
  <div class="nc-box" style="background:#F5F4F2;border:1px solid #88888833">
    <div class="nc-box-num" style="color:#555">${obs}</div>
    <div class="nc-box-lbl" style="color:#555">Observações</div>
  </div>
</div>

<div class="elaborador">
  Relatório elaborado por <strong>${r.auditorNome}</strong> em ${new Date(r.data).toLocaleDateString("pt-BR", { day:"2-digit", month:"long", year:"numeric" })}
</div>

${secao("Conclusões da Auditoria", r.conclusoes)}
${secao("Recomendações", r.recomendacoes)}
${secao("Observações Adicionais", r.observacoes)}

${auditoria.ncs?.length > 0 ? `
<div class="secao">
  <div class="sec-titulo">Não Conformidades e Evidências (${auditoria.ncs.length})</div>
  <div class="ncs-lista">
    ${auditoria.ncs.map(n => {
      const cores = { nc: ["#FFEBEB","#E8001D"], mel: ["#E8F4FF","#0066CC"], obs: ["#F5F4F2","#555555"] };
      const [bg, c] = cores[n.clas] || cores.obs;
      const lbls = { nc: "NC", mel: "Melhoria", obs: "Obs" };
      return `<div class="nc-item" style="background:${bg};border:1px solid ${c}33">
        <span class="nc-tag" style="background:${c}22;color:${c}">${lbls[n.clas] || "—"}</span>${n.q}
        ${n.evidencia ? `<div class="evidencia"><strong>Evidência:</strong> ${n.evidencia}</div>` : ""}
      </div>`;
    }).join("")}
  </div>
</div>` : ""}

${auditoria.comentarios?.length > 0 ? `
<div class="secao">
  <div class="sec-titulo">Comentários do Comitê (${auditoria.comentarios.length})</div>
  ${auditoria.comentarios.map(c => `
    <div style="padding:10px 14px;background:#F5F4F2;border-radius:7px;margin-bottom:8px">
      <div style="font-size:11px;font-weight:700;color:#888;margin-bottom:4px">${c.usuarioNome} · ${new Date(c.data).toLocaleDateString("pt-BR")}</div>
      <div style="font-size:13px">${c.texto}</div>
    </div>`).join("")}
</div>` : ""}

<div class="footer">Fast Sistemas Construtivos — Relatório Final de Auditoria — Uso Interno</div>
<button class="print-btn no-print" onclick="window.print()">🖨 Imprimir / Salvar PDF</button>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  if (!win) alert("Permita pop-ups para gerar o PDF.");
}

function RelatorioFinalViewModal({ open, onClose, auditoria }) {
  if (!auditoria?.relatorioFinal) return null;
  const r = auditoria.relatorioFinal;
  return (
    <Modal open={open} onClose={onClose} title="Relatório Final de Auditoria" width={560}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
          <Btn variant="ghost" onClick={onClose}>Fechar</Btn>
          <Btn onClick={() => gerarPDFRelatorioFinal(auditoria)} style={{ background: F.red, border: "none", color: "#fff" }}>🖨 Gerar PDF</Btn>
        </div>
      }>
      <div style={{ background: F.offWhite, borderRadius: 8, padding: "10px 14px", marginBottom: 18, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 800, color: F.charcoal }}>{auditoria.areaNome}</div>
          <div style={{ fontSize: 11.5, color: F.gray4, marginTop: 2 }}>Auditado em {fmtDate(auditoria.data)} · {auditoria.auditorNome}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 32, fontWeight: 900, color: scoreColor(auditoria.score), lineHeight: 1 }}>{auditoria.score}%</div>
          <div style={{ fontSize: 10, color: scoreColor(auditoria.score), fontWeight: 700, textTransform: "uppercase" }}>{scoreLabel(auditoria.score)}</div>
        </div>
      </div>

      {auditoria.comite?.dataReuniao && (
        <div style={{ background: "#FFF3CD", border: "1px solid #FFC10744", borderRadius: 7, padding: "8px 12px", marginBottom: 14, fontSize: 12.5, color: "#856404" }}>
          📅 Reunião do Comitê agendada para <strong>{fmtDate(auditoria.comite.dataReuniao)}</strong>
        </div>
      )}

      <div style={{ fontSize: 11, color: F.gray4, marginBottom: 16 }}>
        Elaborado por <strong style={{ color: F.charcoal }}>{r.auditorNome}</strong> em {fmtDate(r.data?.split("T")[0])}
      </div>

      {[["Conclusões", r.conclusoes], ["Recomendações", r.recomendacoes], ["Observações Adicionais", r.observacoes]].filter(([, v]) => v).map(([label, valor]) => (
        <div key={label} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: F.gray4, fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 13.5, color: F.charcoal, lineHeight: 1.7, background: F.offWhite, borderRadius: 7, padding: "10px 14px" }}>{valor}</div>
        </div>
      ))}

      {auditoria.comentarios?.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: F.gray4, fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 8 }}>Comentários do Comitê ({auditoria.comentarios.length})</div>
          {auditoria.comentarios.map(c => (
            <div key={c.id} style={{ background: F.offWhite, borderRadius: 6, padding: "8px 10px", marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: F.gray3, marginBottom: 2 }}>{c.usuarioNome} · {fmtDate(c.data?.split("T")[0])}</div>
              <div style={{ fontSize: 12.5, color: F.charcoal }}>{c.texto}</div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function RelatorioFinalModal({ open, onClose, auditoria, onSave }) {
  const [f, setF] = useState({ conclusoes: "", recomendacoes: "", observacoes: "" });
  useEffect(() => { if (open) setF({ conclusoes: auditoria?.relatorioFinal?.conclusoes || "", recomendacoes: auditoria?.relatorioFinal?.recomendacoes || "", observacoes: auditoria?.relatorioFinal?.observacoes || "" }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!auditoria) return null;
  return (
    <Modal open={open} onClose={onClose} title="Relatório Final de Auditoria" width={560}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={() => { if (!f.conclusoes.trim()) { alert("Informe as conclusões."); return; } onSave(auditoria.id, f); }}>✓ Enviar ao Administrador</Btn></>}>
      <div style={{ background: F.offWhite, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12.5, color: F.charcoal }}>
        <strong>{auditoria.areaNome}</strong> · {fmtDate(auditoria.data)} · Score: <strong style={{ color: scoreColor(auditoria.score) }}>{auditoria.score}%</strong>
      </div>
      <FG label="Conclusões da Auditoria *">
        <textarea style={{ ...fi, resize: "vertical", minHeight: 90 }} value={f.conclusoes} onChange={e => setF({ ...f, conclusoes: e.target.value })} placeholder="Descreva as principais conclusões da auditoria..." />
      </FG>
      <FG label="Recomendações">
        <textarea style={{ ...fi, resize: "vertical", minHeight: 70 }} value={f.recomendacoes} onChange={e => setF({ ...f, recomendacoes: e.target.value })} placeholder="Ações e melhorias recomendadas..." />
      </FG>
      <FG label="Observações Adicionais">
        <textarea style={{ ...fi, resize: "vertical", minHeight: 60 }} value={f.observacoes} onChange={e => setF({ ...f, observacoes: e.target.value })} placeholder="Outras informações relevantes..." />
      </FG>
    </Modal>
  );
}

function CienciaModal({ open, onClose, auditoria, usuarioLogado, onSave }) {
  const hoje = new Date().toISOString().split("T")[0];
  const [f, setF] = useState({ data: hoje, observacoes: "", confirmado: false });
  useEffect(() => { if (open) setF({ data: hoje, observacoes: "", confirmado: false }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!auditoria) return null;
  const ncc = auditoria.ncs?.filter(n => n.clas === "nc").length || 0;
  const mel = auditoria.ncs?.filter(n => n.clas === "mel").length || 0;
  return (
    <Modal open={open} onClose={onClose} title="Registrar Ciência do Auditado" width={520}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={() => { if (!f.confirmado) { alert("Confirme a ciência antes de registrar."); return; } onSave(f); }}>✓ Registrar Ciência</Btn></>}>
      {/* Resumo */}
      <div style={{ background: F.offWhite, borderRadius: 10, padding: 14, marginBottom: 18, display: "flex", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 2 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: F.gray4, textTransform: "uppercase", letterSpacing: 1, fontFamily: "'Barlow Condensed',sans-serif" }}>Área Auditada</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: F.charcoal, marginTop: 2 }}>{auditoria.areaNome}</div>
          <div style={{ fontSize: 11, color: F.gray4, marginTop: 1 }}>{fmtDate(auditoria.data)} · {auditoria.auditorNome}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: F.gray4, textTransform: "uppercase", letterSpacing: 1, fontFamily: "'Barlow Condensed',sans-serif" }}>Score</div>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 28, fontWeight: 900, color: scoreColor(auditoria.score), lineHeight: 1.1 }}>{auditoria.score}%</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: F.gray4, textTransform: "uppercase", letterSpacing: 1, fontFamily: "'Barlow Condensed',sans-serif" }}>NCs</div>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 900, color: F.red }}>{ncc}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: F.gray4, textTransform: "uppercase", letterSpacing: 1, fontFamily: "'Barlow Condensed',sans-serif" }}>Melhorias</div>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 900, color: F.blue }}>{mel}</div>
        </div>
      </div>

      <div style={{ background: "#fff", border: `1.5px solid ${F.gray6}`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12.5 }}>
        <strong>Responsável pelo registro:</strong> <span style={{ color: F.red }}>{usuarioLogado?.nome || "—"}</span>
      </div>

      <FG label="Data da Ciência">
        <input type="date" style={fi} value={f.data} onChange={e => setF({ ...f, data: e.target.value })} />
      </FG>

      <FG label="Observações (opcional)">
        <textarea style={{ ...fi, resize: "vertical", minHeight: 70 }} value={f.observacoes} onChange={e => setF({ ...f, observacoes: e.target.value })} placeholder="Registre comentários, discordâncias ou informações adicionais..." />
      </FG>

      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginTop: 4, padding: "12px 14px", background: f.confirmado ? F.greenDim : F.offWhite, border: `1.5px solid ${f.confirmado ? F.green : F.gray6}`, borderRadius: 8, transition: "all 0.15s" }}>
        <input type="checkbox" checked={f.confirmado} onChange={e => setF({ ...f, confirmado: e.target.checked })} style={{ accentColor: F.green, width: 15, height: 15, marginTop: 2, flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: F.charcoal, lineHeight: 1.5 }}>
          <strong>Confirmo que fui informado(a)</strong> sobre os resultados desta auditoria e estou ciente das não conformidades e relatórios de conclusão gerados.
        </span>
      </label>
    </Modal>
  );
}

function JustificativaModal({ open, onClose, plano, onSave }) {
  const [f, setF] = useState({ motivo: "", novoPrazo: "" });
  useEffect(() => { if (open) setF({ motivo: "", novoPrazo: "" }); }, [open]);
  function save() {
    if (!f.motivo.trim()) { alert("Informe o motivo do atraso."); return; }
    if (!f.novoPrazo) { alert("Informe o novo prazo solicitado."); return; }
    onSave(f);
  }
  return (
    <Modal open={open} onClose={onClose} title="Justificar Atraso" width={480}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={save}>Solicitar Extensão</Btn></>}>
      {plano && (
        <div style={{ background: F.amberDim, border: `1px solid ${F.amber}44`, borderRadius: 7, padding: "10px 12px", marginBottom: 16, fontSize: 12.5, color: F.charcoal }}>
          <strong>{plano.desc}</strong><br/>
          <span style={{ color: F.gray3 }}>{plano.areaNome} · Prazo original: {fmtDate(plano.prazo)}</span>
        </div>
      )}
      <FG label="Motivo do Atraso *">
        <textarea style={{ ...fi, resize: "vertical", minHeight: 80 }} value={f.motivo} onChange={e => setF({ ...f, motivo: e.target.value })} placeholder="Descreva o motivo do atraso..." />
      </FG>
      <FG label="Novo Prazo Solicitado *">
        <input type="date" style={fi} value={f.novoPrazo} onChange={e => setF({ ...f, novoPrazo: e.target.value })} />
      </FG>
    </Modal>
  );
}

function HistoricoModal({ open, onClose, plano }) {
  if (!plano) return null;
  const eventos = [...(plano.historico || [])].reverse();
  return (
    <Modal open={open} onClose={onClose} title={`Histórico — ${plano.desc?.slice(0, 40)}${plano.desc?.length > 40 ? "…" : ""}`} width={520}>
      {eventos.length === 0 ? (
        <div style={{ textAlign: "center", padding: "30px 0", color: F.gray4, fontSize: 13 }}>Nenhum evento registrado.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {eventos.map((e, i) => (
            <div key={i} style={{ display: "flex", gap: 14, padding: "11px 0", borderBottom: i < eventos.length - 1 ? `1px solid ${F.gray6}` : "none" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: F.red, flexShrink: 0, marginTop: 5 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: F.charcoal }}>{e.acao}</div>
                <div style={{ fontSize: 11, color: F.gray4, marginTop: 2 }}>{e.autor} · {fmtDate(e.data?.split("T")[0])} {e.data ? new Date(e.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function ModuloModal({ open, onClose, areas, processos, modulo, onSave }) {
  const isEdit = modulo && modulo.id;
  const empty = { nome: "", descricao: "", areaIds: [], processoIds: [], perguntas: [{ id: "p1", texto: "" }], ativo: true };
  const [f, setF] = useState(empty);

  useEffect(() => {
    if (open) setF(isEdit ? { ...modulo, perguntas: modulo.perguntas?.length ? modulo.perguntas : [{ id: uid(), texto: "" }] } : { nome: "", descricao: "", areaIds: [], processoIds: [], perguntas: [{ id: "p1", texto: "" }], ativo: true });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleArea(id) { setF(x => ({ ...x, areaIds: x.areaIds.includes(id) ? x.areaIds.filter(a => a !== id) : [...x.areaIds, id] })); }
  function toggleProcesso(id) { setF(x => ({ ...x, processoIds: x.processoIds.includes(id) ? x.processoIds.filter(p => p !== id) : [...x.processoIds, id] })); }
  function addPergunta() { setF(x => ({ ...x, perguntas: [...x.perguntas, { id: uid(), texto: "" }] })); }
  function removePergunta(id) { setF(x => ({ ...x, perguntas: x.perguntas.filter(p => p.id !== id) })); }
  function editPergunta(id, texto) { setF(x => ({ ...x, perguntas: x.perguntas.map(p => p.id === id ? { ...p, texto } : p) })); }
  function moverPergunta(idx, dir) {
    setF(x => {
      const arr = [...x.perguntas];
      const dest = idx + dir;
      if (dest < 0 || dest >= arr.length) return x;
      [arr[idx], arr[dest]] = [arr[dest], arr[idx]];
      return { ...x, perguntas: arr };
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Editar Categoria de Avaliação" : "Nova Categoria de Avaliação"} width={640}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", color: F.gray3 }}>
            <input type="checkbox" checked={f.ativo} onChange={e => setF({ ...f, ativo: e.target.checked })} style={{ accentColor: F.red, width: 14, height: 14 }} />
            Categoria ativa
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn onClick={() => onSave(f, isEdit ? modulo.id : null)}>{isEdit ? "Salvar alterações" : "Criar Categoria"}</Btn>
          </div>
        </div>
      }>

      <FG label="Nome da categoria">
        <input style={fi} value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} placeholder="ex: Financeiro" />
      </FG>
      <FG label="Descrição (opcional)">
        <textarea style={{ ...fi, resize: "vertical", minHeight: 54 }} value={f.descricao} onChange={e => setF({ ...f, descricao: e.target.value })} placeholder="Contexto ou objetivo desta categoria..." />
      </FG>

      <FG label="Vincular a áreas">
        {areas.filter(a => !a.naoAuditada && !a.noa).length === 0
          ? <div style={{ fontSize: 12, color: F.gray4 }}>Nenhuma área cadastrada.</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {areas.filter(a => !a.naoAuditada && !a.noa).map(a => (
                <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={f.areaIds.includes(a.id)} onChange={() => toggleArea(a.id)} style={{ accentColor: F.red, width: 14, height: 14 }} />
                  <span>{a.nome}</span>
                  {(a.categoria || a.grupo) && <Tag style={{ marginLeft: 2 }}>{a.categoria || a.grupo}</Tag>}
                </label>
              ))}
            </div>
        }
      </FG>

      {processos.length > 0 && (
        <FG label="Vincular a processos (opcional)">
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 120, overflowY: "auto" }}>
            {processos.map(p => (
              <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={f.processoIds.includes(p.id)} onChange={() => toggleProcesso(p.id)} style={{ accentColor: F.red, width: 14, height: 14 }} />
                {p.nome} <span style={{ fontSize: 11, color: F.gray4 }}>· {p.areaNome}</span>
              </label>
            ))}
          </div>
        </FG>
      )}

      <FG label="Perguntas da categoria">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {f.perguntas.map((p, i) => (
            <div key={p.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: F.gray5, fontWeight: 700, minWidth: 20, textAlign: "right" }}>{i + 1}.</span>
              <input style={{ ...fi, flex: 1 }} value={p.texto} onChange={e => editPergunta(p.id, e.target.value)} placeholder="Digite a pergunta..." />
              <select value={p.peso || 1} onChange={e => setF(x => ({ ...x, perguntas: x.perguntas.map(q => q.id === p.id ? { ...q, peso: Number(e.target.value) } : q) }))} style={{ background: F.offWhite, border: `1.5px solid ${F.gray6}`, borderRadius: 5, fontSize: 11.5, padding: "6px 6px", color: F.charcoal, flexShrink: 0 }}>
                <option value={1}>Normal</option>
                <option value={2}>Importante</option>
                <option value={3}>Crítico</option>
              </select>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <button onClick={() => moverPergunta(i, -1)} disabled={i === 0} style={{ background: "none", border: "none", cursor: i === 0 ? "default" : "pointer", fontSize: 10, color: i === 0 ? F.gray6 : F.gray4, padding: "0 3px", lineHeight: 1 }}>▲</button>
                <button onClick={() => moverPergunta(i, 1)} disabled={i === f.perguntas.length - 1} style={{ background: "none", border: "none", cursor: i === f.perguntas.length - 1 ? "default" : "pointer", fontSize: 10, color: i === f.perguntas.length - 1 ? F.gray6 : F.gray4, padding: "0 3px", lineHeight: 1 }}>▼</button>
              </div>
              {f.perguntas.length > 1 && (
                <button onClick={() => removePergunta(p.id)} style={{ background: "none", border: "none", color: F.gray4, cursor: "pointer", fontSize: 15, padding: "2px 4px" }}>✕</button>
              )}
            </div>
          ))}
          <button onClick={addPergunta} style={{ alignSelf: "flex-start", fontSize: 12, color: F.red, background: "none", border: `1px dashed ${F.redBorder}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontWeight: 600, fontFamily: "'Barlow',sans-serif", marginTop: 2 }}>
            + Adicionar Pergunta
          </button>
        </div>
      </FG>
    </Modal>
  );
}

function AuditoriaModal({ open, onClose, step, setStep, form, setForm, checklist, setChecklist, areas, usuarios, ciclos, modulos, buildChecklist, calcScore, onFinalizar }) {
  function next() {
    if (step === 1) {
      if (!form.areaId) { alert("Selecione uma área."); return; }
      setChecklist(buildChecklist(form.areaId));
    }
    if (step === 2) {
      const missing = checklist.filter(i => i.resp === "nok" && !i.evidencia?.trim());
      if (missing.length > 0) { alert(`${missing.length} item(ns) NOK sem evidência preenchida.`); return; }
    }
    if (step === 3) { onFinalizar(); return; }
    setStep(s => s + 1);
  }
  function prev() { setStep(s => s - 1); }

  const score = step === 3 ? calcScore(checklist) : null;
  const noks = checklist.filter(i => i.resp === "nok");

  const area = areas.find(a => a.id === form.areaId);
  const modCores = [F.amber, F.blue, "#9b6dff", F.green, F.red];
  const modBgs = [F.amberDim, F.blueDim, "rgba(155,109,255,0.1)", F.greenDim, F.redDim];
  const mods = area && modulos ? modulos.filter(m =>
    m.ativo && (m.areaIds?.includes(form.areaId) || area?.blocoPerguntas?.includes(m.id))
  ).map((m, i) => ({ l: m.nome, c: modCores[i % modCores.length], bg: modBgs[i % modBgs.length] })) : [];

  const sections = [...new Set(checklist.map(i => i.sec))];

  return (
    <Modal open={open} onClose={onClose} title={["Nova Auditoria","Checklist de Verificação","Resultado e Relatórios de Conclusão"][step-1]} width={640}
      footer={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <div style={{ display: "flex", gap: 8 }}>
            {step > 1 && <Btn variant="ghost" onClick={prev}>← Voltar</Btn>}
            <Btn onClick={next}>{step === 3 ? "✓ Finalizar Auditoria" : "Próximo →"}</Btn>
          </div>
        </div>
      }>
      <Steps step={step} />

      {/* STEP 1 */}
      {step === 1 && (
        <div>
          <FG label="Área a auditar">
            <select style={fi} value={form.areaId || ""} onChange={e => setForm({ ...form, areaId: e.target.value })}>
              <option value="">Selecione uma área...</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </FG>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FG label="Auditor responsável">
              <select style={fi} value={form.auditorId || ""} onChange={e => setForm({ ...form, auditorId: e.target.value })}>
                <option value="">Selecione...</option>
                {usuarios.filter(u => ["administrador","auditor-lider","auditor","gestor"].includes(u.perfil)).map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </FG>
            <FG label="Data"><input type="date" style={fi} value={form.data || ""} onChange={e => setForm({ ...form, data: e.target.value })} /></FG>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FG label="Ciclo">
              <select style={fi} value={form.cicloId || ""} onChange={e => setForm({ ...form, cicloId: e.target.value })}>
                <option value="">Sem ciclo</option>
                {ciclos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </FG>
            <FG label="Local / Unidade"><input style={fi} value={form.local || ""} onChange={e => setForm({ ...form, local: e.target.value })} placeholder="ex: São Paulo — SP" /></FG>
          </div>
          {mods.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: F.gray4, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontFamily: "'Barlow Condensed',sans-serif" }}>Categorias incluídas automaticamente</div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {mods.map((m, i) => (
                  <span key={i} style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, background: m.bg, border: `1px solid ${m.c}44`, color: m.c }}>{m.l}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div>
          {sections.map(sec => (
            <div key={sec} style={{ marginBottom: 18 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: 1.5, color: F.gray4, padding: "7px 0",
                borderBottom: `1.5px solid ${F.gray6}`, marginBottom: 10,
                fontFamily: "'Barlow Condensed',sans-serif"
              }}>{sec}</div>
              {checklist.filter(i => i.sec === sec).map(item => (
                <div key={item.id} style={{ padding: "10px 0", borderBottom: `1px solid ${F.offWhite}` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5, paddingTop: 2 }}>
                      {item.q}
                      {item.peso === 3 && <span style={{ marginLeft: 7, fontSize: 9.5, fontWeight: 700, background: F.redDim, color: F.red, padding: "1px 6px", borderRadius: 3, fontFamily: "'Barlow Condensed',sans-serif", textTransform: "uppercase", letterSpacing: 0.5 }}>Crítico</span>}
                      {item.peso === 2 && <span style={{ marginLeft: 7, fontSize: 9.5, fontWeight: 700, background: F.amberDim, color: F.amber, padding: "1px 6px", borderRadius: 3, fontFamily: "'Barlow Condensed',sans-serif", textTransform: "uppercase", letterSpacing: 0.5 }}>Importante</span>}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      {[["ok","✓ Sim",F.green,F.greenDim],["nok","✗ Não",F.red,F.redDim],["na","N/A",F.gray3,F.gray6]].map(([v,l,c,bg]) => (
                        <button key={v} onClick={() => setChecklist(cl => cl.map(x => x.id === item.id ? { ...x, resp: v } : x))} style={{
                          padding: "4px 11px", borderRadius: 5, fontSize: 11.5, fontWeight: 600,
                          cursor: "pointer", border: `1.5px solid ${item.resp === v ? c : F.gray6}`,
                          background: item.resp === v ? bg : "transparent",
                          color: item.resp === v ? c : F.gray4, transition: "all 0.12s",
                          fontFamily: "'Barlow',sans-serif"
                        }}>{l}</button>
                      ))}
                    </div>
                  </div>
                  {/* Evidência — sempre visível */}
                  <div style={{ marginTop: 7 }}>
                    <input
                      style={{ ...fi, fontSize: 12, textTransform: "none", borderColor: item.resp === "nok" && !item.evidencia?.trim() ? F.amber : F.gray6 }}
                      value={item.evidencia || ""}
                      onChange={e => setChecklist(cl => cl.map(x => x.id === item.id ? { ...x, evidencia: e.target.value } : x))}
                      placeholder={item.resp === "nok" ? "Evidência obrigatória — descreva ou informe o link do documento..." : "Evidência ou link do documento (opcional)..."}
                    />
                    {item.resp === "nok" && !item.evidencia?.trim() && (
                      <div style={{ fontSize: 10, color: F.amber, fontWeight: 700, marginTop: 3 }}>Evidência obrigatória</div>
                    )}
                  </div>
                  {item.resp === "nok" && (
                    <div style={{ marginTop: 8, background: F.offWhite, borderRadius: 7, border: `1px solid ${F.gray6}`, padding: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: F.gray4, textTransform: "uppercase", letterSpacing: 1, marginBottom: 7, fontFamily: "'Barlow Condensed',sans-serif" }}>Classificação</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {[["obs","Observação",F.gray3,F.gray6],["mel","Oportunidade de Melhoria",F.blue,F.blueDim],["nc","Não Conformidade",F.red,F.redDim]].map(([v,l,c,bg]) => (
                          <button key={v} onClick={() => setChecklist(cl => cl.map(x => x.id === item.id ? { ...x, clas: v } : x))} style={{
                            padding: "3px 10px", borderRadius: 5, fontSize: 11, fontWeight: 600,
                            cursor: "pointer", border: `1.5px solid ${item.clas === v ? c : F.gray6}`,
                            background: item.clas === v ? bg : "transparent",
                            color: item.clas === v ? c : F.gray4, transition: "all 0.12s",
                            fontFamily: "'Barlow',sans-serif"
                          }}>{l}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div>
          <div style={{
            background: F.offWhite, borderRadius: 10, padding: 20,
            textAlign: "center", marginBottom: 18,
            border: `2px solid ${scoreColor(score)}`
          }}>
            <div style={{
              fontFamily: "'Barlow Condensed',sans-serif", fontSize: 56,
              fontWeight: 900, lineHeight: 1, color: scoreColor(score)
            }}>{score}%</div>
            <div style={{
              fontSize: 14, fontWeight: 700, color: scoreColor(score),
              textTransform: "uppercase", letterSpacing: 1,
              fontFamily: "'Barlow Condensed',sans-serif", marginTop: 4
            }}>{scoreLabel(score)}</div>
          </div>

          {noks.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: F.gray4, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontFamily: "'Barlow Condensed',sans-serif" }}>
                Itens não conformes — selecione para gerar relatórios de conclusão
              </div>
              {noks.map(item => {
                const cmap = { nc: [F.red, F.redDim, "Não Conformidade"], mel: [F.blue, F.blueDim, "Oportunidade"], obs: [F.gray3, F.gray6, "Observação"] };
                const [c, bg, lbl] = cmap[item.clas || "obs"];
                const isCritical = item.peso === 3 && item.clas === "nc";
                return (
                  <div key={item.id} style={{
                    display: "flex", alignItems: "flex-start", gap: 10,
                    padding: "9px 12px", borderRadius: 7, marginBottom: 6,
                    background: bg, border: `2px solid ${isCritical ? F.red : `${c}33`}`
                  }}>
                    <input type="checkbox" defaultChecked={item.clas === "nc"} onChange={e => setChecklist(cl => cl.map(x => x.id === item.id ? { ...x, selected: e.target.checked } : x))} style={{ accentColor: F.red, width: 13, height: 13, marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.5 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span>{item.q}</span>
                        {isCritical && <span style={{ fontSize: 9.5, fontWeight: 700, background: F.red, color: "#fff", padding: "1px 6px", borderRadius: 3, fontFamily: "'Barlow Condensed',sans-serif", textTransform: "uppercase" }}>Item Crítico</span>}
                      </div>
                      {item.evidencia && <div style={{ fontSize: 11, color: F.gray3, marginTop: 2 }}>Evidência: {item.evidencia}</div>}
                      <div style={{ marginTop: 8 }}>
                        <select
                          value={item.causaRaiz || ""}
                          onChange={e => setChecklist(cl => cl.map(x => x.id === item.id ? { ...x, causaRaiz: e.target.value } : x))}
                          style={{ ...fi, fontSize: 11.5, padding: "4px 8px", borderColor: !item.causaRaiz ? F.amber : F.gray6 }}
                        >
                          <option value="">Selecione a causa raiz...</option>
                          {CAUSAS_RAIZ.map(cr => <option key={cr} value={cr}>{cr}</option>)}
                        </select>
                        {!item.causaRaiz && <div style={{ fontSize: 10, color: F.amber, fontWeight: 700, marginTop: 3 }}>Selecione a causa raiz</div>}
                      </div>
                    </div>
                    <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 3, background: `${c}22`, color: c, whiteSpace: "nowrap", fontFamily: "'Barlow Condensed',sans-serif", textTransform: "uppercase", letterSpacing: 0.5 }}>{lbl}</span>
                  </div>
                );
              })}
              <div style={{ fontSize: 12, color: F.gray3, background: F.redDim, border: `1px solid ${F.redBorder}`, borderRadius: 7, padding: "9px 12px", marginTop: 8, lineHeight: 1.6 }}>
                Não Conformidades geram relatório de conclusão obrigatório. Oportunidades ficam a critério do gestor.
              </div>
            </div>
          )}

          <FG label="Observações gerais">
            <textarea style={{ ...fi, resize: "vertical", minHeight: 70 }} value={form.obs || ""} onChange={e => setForm({ ...form, obs: e.target.value })} placeholder="Pontos positivos, contexto adicional, destaques..." />
          </FG>
        </div>
      )}

    </Modal>
  );
}

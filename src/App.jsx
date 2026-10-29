import { useState, useEffect, useRef, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, Line, ComposedChart, CartesianGrid, LabelList,
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
  .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  @media (max-width: 768px) {
    .resp-grid-5 { grid-template-columns: repeat(2,1fr) !important; }
    .resp-grid-4 { grid-template-columns: repeat(2,1fr) !important; }
    .resp-grid-2 { grid-template-columns: 1fr !important; }
    .resp-grid-3 { grid-template-columns: 1fr !important; }
    .resp-hide { display: none !important; }
    .resp-full { width: 100% !important; }
    .resp-stack { flex-direction: column !important; }
    .resp-wrap { flex-wrap: wrap !important; }
    .modal-inner { padding: 14px !important; }
  }
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


// ── HELPERS ───────────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
const U = v => typeof v === "string" ? v.toUpperCase() : v;
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
    views: ["dashboard","cronograma","bonus","auditorias","relatorio-conclusao","planos","ncs","ciclos","usuarios","despesas"],
    acoes: new Set(["criar","excluir","aprovar","exportar","auditar","atualizar-status","gerir-ciclos","comentar-auditoria","relatorio-final"])
  },
  "area-processos": {
    views: ["dashboard","cronograma","bonus","auditorias","relatorio-conclusao","planos","ncs","ciclos","usuarios","despesas"],
    acoes: new Set(["criar","excluir","aprovar","exportar","atualizar-status","gerir-ciclos"])
  },
  auditor: {
    views: ["dashboard","cronograma","bonus","auditorias","relatorio-conclusao","consolidar","planos","ncs","ciclos"],
    acoes: new Set(["auditar","exportar","gerir-ciclos","relatorio-final","comentar-auditoria","consolidar"])
  },
  gestor: {
    views: ["dashboard","relatorio-conclusao","planos","auditorias"],
    acoes: new Set(["atualizar-status"])
  }
};
function podeAcessar(perfil, viewId) { return PERMISSOES[perfil]?.views.includes(viewId) ?? false; }
function podeExecutar(perfil, acao) { return PERMISSOES[perfil]?.acoes.has(acao) ?? false; }
const PERFIL_LABEL = {
  administrador: "Administrador", "area-processos": "Área de Processos", gestor: "Gestor de Área",
  auditor: "Auditor", diretoria: "Diretoria", operacional: "Operacional"
};
const PERFIL_COR = {
  administrador: "#E8001D", "area-processos": "#D4580A", gestor: "#0066CC",
  auditor: "#00B050", diretoria: "#FF8C00", operacional: "#555555"
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
function Btn({ variant = "primary", onClick, children, style = {}, type = "button", disabled = false }) {
  const styles = {
    primary: { background: F.red, color: "#fff", border: "none" },
    ghost: { background: "#fff", color: F.charcoal, border: `1.5px solid ${F.gray6}` },
    danger: { background: F.redDim, color: F.red, border: `1.5px solid ${F.redBorder}` },
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick} style={{
      ...styles[variant], opacity: disabled ? 0.6 : 1,
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
      backdropFilter: "blur(4px)", zIndex: 210,
      display: "flex", alignItems: window.innerWidth <= 768 ? "flex-end" : "center", justifyContent: "center",
      animation: "fadeIn 0.2s ease"
    }}>
      <div style={{
        background: "#fff", borderRadius: window.innerWidth <= 768 ? "12px 12px 0 0" : 12,
        width: window.innerWidth <= 768 ? "100%" : width,
        maxWidth: "100vw", maxHeight: window.innerWidth <= 768 ? "92vh" : "88vh",
        display: "flex", flexDirection: "column",
        overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
        animation: "slideIn 0.25s ease",
        position: window.innerWidth <= 768 ? "fixed" : "relative",
        bottom: window.innerWidth <= 768 ? 0 : "auto"
      }}>
        <div style={{
          padding: window.innerWidth <= 768 ? "14px 16px 12px" : "18px 24px 16px", borderBottom: `1px solid ${F.gray6}`,
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
        <div className="modal-inner" style={{ padding: window.innerWidth <= 768 ? "14px 14px" : "20px 24px", overflowY: "auto", flex: 1, WebkitOverflowScrolling: "touch" }}>{children}</div>
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
    <div className="table-scroll">
    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
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
    </div>
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
function EvidenciaInline({ planoId, onSave }) {
  const [texto, setTexto] = useState("");
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
      <input
        style={{ ...fi, flex: 1, fontSize: 12.5, textTransform: "none" }}
        value={texto}
        onChange={e => setTexto(e.target.value)}
        placeholder="Descreva a evidência ou cole o link do documento..."
        onKeyDown={e => { if (e.key === "Enter" && texto.trim()) { onSave(planoId, texto); setTexto(""); } }}
      />
      <Btn onClick={() => { if (texto.trim()) { onSave(planoId, texto); setTexto(""); } }} style={{ padding: "7px 12px", fontSize: 12 }}>Anexar</Btn>
    </div>
  );
}

// ── LOGIN SCREEN ─────────────────────────────────────────────────
const SESSAO_KEY = "portal-fast-sessao";

function LoginScreen({ usuarios, carregando, onLogin }) {
  const [logoSrc, setLogoSrc] = useState("");
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    fetch("/logo-fast-sistemas-construtivos.svg")
      .then(r => r.text())
      .then(t => setLogoSrc(`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(t)))}`))
      .catch(() => {});
  }, []);

  function entrar(e) {
    e.preventDefault();
    setErro("");
    if (carregando) return;
    const u = email.trim() && usuarios.find(x => x.email?.trim().toLowerCase() === email.trim().toLowerCase());
    if (!u) { setErro("E-mail não cadastrado."); return; }
    onLogin(u);
  }

  return (
    <div style={{ minHeight: "100vh", background: F.offWhite, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <style>{css}</style>
      {logoSrc && <img src={logoSrc} alt="Fast Sistemas Construtivos" style={{ height: 58, marginBottom: 36 }} />}
      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 26, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1, color: F.charcoal, marginBottom: 6 }}>
        Acesse o portal
      </div>
      <div style={{ fontSize: 13, color: F.gray4, marginBottom: 32, textAlign: "center" }}>
        Portal de Gestão — Fast Sistemas Construtivos
      </div>

      <div className="anim" style={{ width: "100%", maxWidth: 380, background: "#fff", borderRadius: 12, border: `1.5px solid ${F.gray6}`, padding: 24 }}>
        <form onSubmit={entrar}>
          <FG label="E-mail"><input type="email" style={fi} value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@fastdrywall.com.br" autoComplete="username" autoFocus /></FG>
          {erro && <div style={{ fontSize: 12.5, color: F.red, fontWeight: 600, marginBottom: 12 }}>{erro}</div>}
          <Btn type="submit" disabled={carregando} style={{ width: "100%", justifyContent: "center" }}>{carregando ? "Carregando dados..." : "Entrar"}</Btn>
        </form>
      </div>
    </div>
  );
}

// ── CRONOGRAMA DE AUDITORIA ──────────────────────────────────────
// Calendário de Auditoria Interna: os mesmos itens são verificados todo mês.
// Ids fixos: as datas do cronograma e as auditorias ficam ligadas a eles,
// então atividade nova ganha id novo e id de atividade removida não é reaproveitado.
// Cada atividade: [id, ação, objetivo, controle interno, metodologia, periodicidade (padrão: Mensal)]
// Áreas com bonus: true, ou atividades com periodicidade "Bônus", ficam na aba Auditorias Bônus: não se repetem todo mês e não têm data padrão
const CRONOGRAMA_ITENS = [
  { id: "cat-1", cat: "Contas a pagar", itens: [
    ["c1-1", "Conferir relatório de contas a pagar e realizar comparativo com documentos fiscais", "Garantir que os lançamentos do sistema estejam em conformidade com os documentos fiscais", "Sistema e documentos fiscais", "Amostragem"],
    ["c1-2", "Validar se as contas pagas obedeceram segregação na autorização de pagamento (Um usuário lança e o outro valida/autoriza)", "Evitar fraudes, garantindo que o processo de autorização de pagamento está sendo cumprido", "Sistema", "Amostragem"],
    ["c1-3", "Verificar se existe algum fornecedor com pagamento em aberto (em atraso) no relatório de Contas a Pagar", "Garantir a inexistência de títulos em aberto a pagar", "Sistema", "Amostragem"],
  ]},
  { id: "cat-2", cat: "Contas a receber", itens: [
    ["c2-1", "Analisar relatório de Contas a Receber acima de 120 dias", "Identificar títulos vencidos há mais de 120 dias e verificar as ações de cobrança", "Sistema", "Todos os títulos acima de 120 dias"],
    ["c2-2", "Realizar consulta de relatório de títulos a receber com vencimento prorrogado e validar processo de autorização da prorrogação", "Garantir que as prorrogações de vencimento foram autorizadas conforme a alçada", "Sistema", "Amostragem"],
    ["c2-4", "Validar créditos não identificados no sistema", "Garantir que os créditos recebidos sejam identificados e baixados corretamente", "Sistema e extrato bancário", "Todos os créditos não identificados"],
    ["c2-5", "Validar descontos concedidos, e verificar se estão de acordo com a política de descontos", "Garantir a aplicação da política de descontos vigente", "Sistema e política de descontos", "Amostragem"],
  ]},
  { id: "cat-3", cat: "Conciliação Bancária", itens: [
    ["c3-1", "Validar saldos dos extratos bancários X saldos de conciliação bancária no sistema", "Garantir que os saldos por dia dos extratos bancários sejam os mesmos dos registrados no sistema", "Sistema e extrato bancário", "Amostragem"],
    ["c3-2", "Validar se os lançamentos do extrato bancário estão em conformidade com o sistema", "Garantir que a movimentação do sistema seja o espelho do extrato bancário", "Sistema e extrato bancário", "Amostragem"],
    ["c3-3", "Identificar transferências no extrato bancário realizadas para pessoa física (CPF) e conferir com o documento fiscal", "Evitar fraudes por transferência para pessoa física", "Sistema e extrato bancário", "Amostragem"],
  ]},
  { id: "cat-4", cat: "Caixa", itens: [
    ["c4-1", "Validar relatório de extrato de dinheiro físico no sistema com os documentos", "Garantir que os pagamentos realizados de dinheiro estão acobertados por documentos fiscais", "Sistema e documentos fiscais", "Amostragem"],
    ["c4-2", "Validar se as contas pagas no caixa obedeceram segregação na autorização de pagamento (Um usuário lança e o outro valida/autoriza)", "Evitar fraudes, garantindo a segregação na autorização de pagamento", "Sistema", "Amostragem"],
    ["c4-3", "Validar saldo de dinheiro no sistema com dinheiro em espécie disponível", "Validar se o saldo em dinheiro físico corresponde ao saldo indicado em sistema", "Sistema", "Amostragem"],
    ["c4-5", "Validar as despesas de fundo fixo das lojas", "Analisar o motivo das pendências de acertos referentes a adiantamentos disponibilizados", "Sistema e comprovantes de adiantamentos assinados", "Amostragem"],
  ]},
  { id: "cat-6", cat: "Faturamento", itens: [
    ["c6-1", "Verificar se existe faturamento em aberto", "Garantir que não há faturamento em aberto", "Sistema", "Todos os faturamentos em atraso", "Diário"],
    ["c6-2", "Validar NFs canceladas no mês e motivos", "Evitar fraudes a partir de cancelamentos de NFs", "Sistema e site da prefeitura", "Todas as NFs canceladas"],
    ["c6-3", "Validar se existe alguma NF que precisaria ser cancelada e não foi", "Evitar fraudes a partir de cancelamentos de NFs", "Sistema", "Amostragem"],
  ]},
  { id: "cat-7", cat: "Departamento Pessoal", itens: [
    ["c7-1", "Validar relatório do planejamento anual de férias", "Verificar se a programação de férias está sendo cumprida", "Controle de planejamento de férias", "Amostragem"],
    ["c7-2", "Validar relatório de horas extras do mês e verificar se foram autorizadas pelo líder imediato", "Garantir que as horas extras realizadas sejam autorizadas pelo líder imediato", "Sistema e controle de autorização de horas extras", "Amostragem"],
    ["c7-3", "Validar benefícios de funcionários (vale transporte, alimentação, convênio etc.) e verificar se a saída no extrato bancário confere com o valor devido", "Garantir que o controle interno dos benefícios esteja de acordo com o realizado no financeiro", "Sistema e controle de benefícios", "Amostragem"],
  ]},
  { id: "cat-8", cat: "Qualificação de fornecedores", bonus: true, itens: [
    ["c8-1", "Verificar se existe processo de qualificação de fornecedores (preço, prazo de entrega, qualidade, atendimento, etc.) e quais são os fornecedores críticos para exclusão", "Garantir o compliance de não favorecimento de fornecedores por brindes, premiações, presentes, etc.", "Sistema ou controle de qualificação de fornecedores", "Amostragem", "Bônus (sem data padrão)"],
  ]},
  { id: "cat-9", cat: "Compras", itens: [
    ["c9-1", "Verificar se toda compra realizada possui Pedido de Compra no sistema", "Garantir que todas as compras possuem pedido de compra registrado no sistema", "Sistema", "Avaliar número de compras X número de Pedidos de Compra"],
    ["c9-2", "Validar novos cadastros de produtos e fornecedores realizados no mês", "Verificar se os cadastros de novos produtos e fornecedores no mês passaram pelas validações fiscais corretas", "Sistema", "Todos os novos cadastros de produtos e fornecedores"],
    ["c9-3", "Validar se todas as compras possuem pelo menos 3 cotações no sistema", "Garantir que o processo de cotações está sendo seguido", "Sistema", "Amostragem", "Bônus (sem data padrão)"],
    ["c9-4", "Validar lista de fornecedores exclusivos (que estão dispensados de realizar cotação, por exemplo por contratos)", "Validar se as compras realizadas sem cotação estão presentes na lista de fornecedores exclusivos", "Controle de fornecedores exclusivos", "Amostragem", "Bônus (sem data padrão)"],
    ["c9-5", "Verificar se as compras realizadas no mês obedeceram os critérios de estoque mínimo e máximo, ou correto atendimento das requisições", "Avaliar o critério de compras utilizado", "Sistema", "Amostragem", "Bônus (sem data padrão)"],
    ["c9-6", "Validar as requisições de compras de usuários, avaliando a necessidade de compra", "Garantir que as requisições de compras estão em conformidade com a necessidade de compra", "Sistema", "Amostragem", "Bônus (sem data padrão)"],
    ["c9-7", "Validar se as compras realizadas no mês passaram por aprovação no sistema", "Validar as alçadas de aprovação no sistema", "Sistema", "Amostragem"],
  ]},
  { id: "cat-13", cat: "Vendas", itens: [
    ["c13-1", "Validar descontos concedidos no mês", "Garantir a aplicação da política de descontos vigente", "Sistema", "Amostragem"],
    ["c13-2", "Validar vendas realizadas com margem negativa", "Entender se há casos de vendas com margem negativa e quais as justificativas", "Sistema", "Todas as vendas com margem negativa"],
    ["c13-3", "Verificar vendas futuras em aberto no sistema", "Analisar conformidade das vendas futuras realizadas", "Sistema", "Todas as vendas futuras realizadas"],
    ["c13-4", "Avaliar processo de devolução de vendas futuras realizadas no mês", "Analisar conformidade das devoluções de vendas futuras realizadas", "Sistema", "Todas as vendas futuras realizadas"],
    ["c13-5", "Avaliação de campanhas comerciais para produtos danificados", "Comercializar produtos danificados em condições especiais", "Sistema", "Produtos danificados no sistema"],
  ]},
  { id: "cat-14", cat: "Segurança da informação", itens: [
    ["c14-1", "Validar se os perfis de usuários do sistema estão em conformidade com os acessos liberados", "Garantir os acessos de usuários conforme liberação do líder imediato", "Sistema", "Amostragem"],
    ["c14-3", "Validar usuários liberados no sistema para realizar ajuste de estoque", "Garantir que somente usuários com permissão possam realizar ajustes de estoque", "Sistema", "Todos os usuários liberados para ajuste de estoques"],
    ["c14-4", "Validar se a política de desconto está em conformidade com os acessos do sistema", "Garantir que os descontos estejam parametrizados em conformidade com a política vigente", "Sistema e política de descontos", "Amostragem"],
    ["c14-5", "Validar evidências de backups realizados do sistema", "Garantir backups", "Sistema", "Amostragem"],
    ["c14-7", "Verificar se os colaboradores desligados no mês continuam com acessos ativos", "Remover acessos de colaboradores desligados", "Sistema", "Amostragem"],
  ]},
  { id: "cat-15", cat: "Infraestrutura", itens: [
    ["c15-1", "Validar controle de ativos de TI e analisar as alocações dos bens", "Garantir que os ativos de TI estejam controlados", "Controle de ativos de TI", "Amostragem"],
  ]},
  { id: "cat-16", cat: "Fiscal", itens: [
    ["c16-1", "Validar se existem NFs que foram emitidas contra o CNPJ da Fast e não deram entrada no sistema", "Garantir que os documentos fiscais estejam registrados no sistema", "Sistema", "Todas as NFs emitidas sem entrada no sistema"],
    ["c16-2", "Validar operações de triangulação", "Garantir a conformidade das operações", "Sistema", "Amostragem", "Diário"],
    ["c16-3", "Validar memória de cálculo dos impostos do mês", "Garantir a correta apuração e pagamento dos impostos", "Memória de cálculo X Guias", "Amostragem"],
  ]},
  { id: "cat-17", cat: "Auditoria de Fretes", itens: [
    ["c17-1", "Fretes Log solicitados x chamados - Realizados", "Validar o lançamento de frete", "Portal de Fretes", "Totalidade", "Diário"],
    ["c17-2", "Unidade e Centro de Custo preenchidos", "Validar o lançamento de frete", "Portal de Fretes", "Totalidade", "Diário"],
    ["c17-3", "Valores Cobrados x Margem Calculada", "Validar o lançamento de frete", "Portal de Fretes", "Totalidade", "Diário"],
    ["c17-4", "Documentos de Margem Aprovados", "Validar o lançamento de frete", "Portal de Fretes", "Totalidade", "Diário"],
    ["c17-5", "Chamados de Fretes Abertos no Sults", "Validar o lançamento de frete", "Portal de Fretes", "Totalidade", "Diário"],
  ]},
].map(g => ({ ...g, itens: g.itens.map(([id, texto, objetivo, controle, metodologia, periodicidade = "Mensal"]) => ({ id, texto, objetivo, controle, periodicidade, metodologia, bonus: !!g.bonus || periodicidade.startsWith("Bônus") })) }));

// As áreas auditáveis são as áreas do cronograma (substituem o cadastro de áreas)
const AREAS_CRONOGRAMA = CRONOGRAMA_ITENS.map(g => ({ id: g.id, nome: g.cat }));

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

// Ciclos mensais de auditoria: Nov/2026 a Dez/2027
const CICLOS_PADRAO = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(2026, 10 + i, 1);
  const ano = d.getFullYear(), mm = String(d.getMonth() + 1).padStart(2, "0");
  const ultimo = new Date(ano, d.getMonth() + 1, 0).getDate();
  return { id: `ciclo-${ano}-${mm}`, nome: `${MESES[d.getMonth()].slice(0, 3).toUpperCase()}/${ano}`, ini: `${ano}-${mm}-01`, fim: `${ano}-${mm}-${ultimo}`, obs: "", status: "ativo" };
});

// ── AUDITORIAS DO MÊS (Relatório de Conclusão) ───────────────────
// Relatório semanal: feito pelo administrador toda quinta-feira,
// com as auditorias de sexta a quinta daquela semana
function ymdLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// Relatório elaborado na quinta, com vigência da sexta anterior até a quinta; o primeiro é o de 05/11/2026
const INICIO_SEMANAIS = "2026-11-01";
function semanasDoMes(mes) {
  const [ano, m] = mes.split("-").map(Number);
  const semanas = [];
  for (let dia = 1; dia <= new Date(ano, m, 0).getDate(); dia++) {
    const d = new Date(ano, m - 1, dia);
    if (d.getDay() !== 4 || ymdLocal(d) < INICIO_SEMANAIS) continue;
    semanas.push({ id: `sem-${ymdLocal(d)}`, quinta: ymdLocal(d), ini: ymdLocal(new Date(ano, m - 1, dia - 6)) });
  }
  return semanas;
}
const auditoriasDaSemana = (auditorias, sem) => auditorias.filter(a => a.data && a.data >= sem.ini && a.data <= sem.quinta);
// Auditorias antigas não guardavam os itens: usa as não conformidades
const itensDaAuditoria = a => a.itensVerificados?.length ? a.itensVerificados : (a.ncs || []).map(n => ({ q: n.q, resp: "nok", obs: n.obs, evidencia: n.evidencia, chamado: n.chamado }));
function statusSemana(sem, rel, hoje) {
  if (rel) return { label: "Elaborado", cor: F.green, bg: F.greenDim };
  if (sem.quinta === hoje) return { label: "Elaborar hoje", cor: F.amber, bg: F.amberDim };
  if (sem.quinta < hoje) return { label: "Atrasado", cor: F.red, bg: F.redDim };
  return { label: "Programado", cor: F.gray4, bg: F.gray6 };
}

function RelatorioSemanalModal({ semana, auditorias, relatorio, onClose, onSave, podeElaborar }) {
  const [f, setF] = useState({ conclusoes: relatorio?.conclusoes || "", recomendacoes: relatorio?.recomendacoes || "", observacoes: relatorio?.observacoes || "" });
  const auds = auditoriasDaSemana(auditorias, semana);
  const itens = auds.flatMap(itensDaAuditoria);
  const conta = r => itens.filter(i => i.resp === r).length;
  const area = { ...fi, resize: "vertical", lineHeight: 1.45 };
  return (
    <Modal open onClose={onClose} title={`Relatório semanal — quinta-feira ${fmtDate(semana.quinta)}`} width={780}
      footer={<><Btn variant="ghost" onClick={onClose}>Fechar</Btn>{podeElaborar && <Btn onClick={() => { if (!f.conclusoes.trim()) { alert("Informe as conclusões da semana."); return; } onSave({ ...semana, ...f, auditoriaIds: auds.map(a => a.id) }); }}>✓ Salvar relatório</Btn>}</>}>
      <div style={{ fontSize: 13, color: F.gray3, marginBottom: 12 }}>
        Auditorias de {fmtDate(semana.ini)} a {fmtDate(semana.quinta)} · {auds.length} auditoria{auds.length !== 1 ? "s" : ""} · {itens.length} ite{itens.length !== 1 ? "ns" : "m"} verificado{itens.length !== 1 ? "s" : ""} · {conta("ok")} conforme{conta("ok") !== 1 ? "s" : ""} · {conta("nok")} não conforme{conta("nok") !== 1 ? "s" : ""}
      </div>
      <div style={{ maxHeight: 260, overflowY: "auto", border: `1px solid ${F.gray6}`, borderRadius: 8, marginBottom: 14 }}>
        {auds.length === 0 ? <div style={{ padding: 20, textAlign: "center", fontSize: 12.5, color: F.gray4 }}>Nenhuma auditoria realizada nesta semana.</div> : auds.map(a => (
          <div key={a.id} style={{ padding: "9px 12px", borderBottom: `1px solid ${F.gray6}`, fontSize: 12, color: F.gray3, lineHeight: 1.5 }}>
            <div style={{ display: "flex", gap: 8 }}><strong style={{ flex: 1, color: F.charcoal, fontSize: 12.5 }}>{a.areaNome}</strong><span style={{ fontWeight: 700, color: scoreColor(a.score) }}>{a.score}%</span></div>
            <div>{a.auditorNome} · {fmtDate(a.data)}</div>
            {itensDaAuditoria(a).filter(i => i.resp === "nok").map((i, k) => <div key={k} style={{ color: F.red, marginTop: 2 }}>✗ {i.q}{i.obs ? ` — ${i.obs}` : ""}</div>)}
          </div>
        ))}
      </div>
      {podeElaborar ? (
        <>
          <FG label="Conclusões da semana *"><textarea style={{ ...area, minHeight: 100 }} value={f.conclusoes} onChange={e => setF({ ...f, conclusoes: e.target.value })} placeholder="Principais resultados encontrados nas auditorias da semana..." /></FG>
          <FG label="Recomendações"><textarea style={{ ...area, minHeight: 70 }} value={f.recomendacoes} onChange={e => setF({ ...f, recomendacoes: e.target.value })} /></FG>
          <FG label="Observações"><textarea style={{ ...area, minHeight: 60 }} value={f.observacoes} onChange={e => setF({ ...f, observacoes: e.target.value })} /></FG>
        </>
      ) : relatorio ? (
        <div style={{ fontSize: 13, color: F.charcoal, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          <strong>Conclusões:</strong> {relatorio.conclusoes}
          {relatorio.recomendacoes && <><br /><strong>Recomendações:</strong> {relatorio.recomendacoes}</>}
          {relatorio.observacoes && <><br /><strong>Observações:</strong> {relatorio.observacoes}</>}
        </div>
      ) : <div style={{ fontSize: 12.5, color: F.gray4 }}>O administrador ainda não elaborou este relatório.</div>}
      {relatorio && <div style={{ fontSize: 11, color: F.gray4, marginTop: 10 }}>Elaborado por {relatorio.autorNome} em {fmtDate(relatorio.data?.slice(0, 10))}</div>}
    </Modal>
  );
}

// Relatório geral do mês: todas as auditorias e os relatórios semanais, pronto para imprimir/PDF
async function gerarRelatorioGeralMes(mes, auditorias, semanais) {
  const esc = t => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");
  let logoSrc = "";
  try {
    const resp = await fetch("/logo-fast-sistemas-construtivos.svg");
    logoSrc = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(await resp.text())))}`;
  } catch {}
  const [ano, m] = mes.split("-").map(Number);
  const auds = auditorias.filter(a => (a.mes || a.data || "").slice(0, 7) === mes).sort((a, b) => a.areaNome.localeCompare(b.areaNome) || (a.data || "").localeCompare(b.data || ""));
  const itens = auds.flatMap(itensDaAuditoria);
  const conta = r => itens.filter(i => i.resp === r).length;
  const media = auds.length ? Math.round(auds.reduce((n, a) => n + (a.score || 0), 0) / auds.length) : 0;
  const RES = { ok: ["Conforme", "#00B050"], nok: ["Não conforme", "#E8001D"], na: ["N/A", "#888888"] };
  const semanas = semanasDoMes(mes);
  const hojeStr = ymdLocal(new Date());
  const parcial = hojeStr < `${mes}-${String(new Date(ano, m, 0).getDate()).padStart(2, "0")}`;

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><title>Relatório Geral — ${MESES[m - 1]} ${ano}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; } body { font-family:Arial,sans-serif; color:#1A1A1A; padding:32px 40px; font-size:13px; }
  .topo { display:flex; align-items:center; justify-content:space-between; border-bottom:3px solid #E8001D; padding-bottom:14px; margin-bottom:22px; }
  h1 { font-size:22px; text-transform:uppercase; } .sub { color:#888; font-size:12px; margin-top:4px; }
  .stats { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; margin-bottom:24px; }
  .stat { border:1px solid #E5E5E5; border-radius:8px; padding:10px 12px; } .stat b { display:block; font-size:22px; } .stat span { font-size:10px; color:#888; text-transform:uppercase; }
  h2 { font-size:14px; text-transform:uppercase; letter-spacing:.5px; margin:22px 0 10px; padding-bottom:6px; border-bottom:1px solid #E5E5E5; }
  .bloco { border:1px solid #E5E5E5; border-radius:8px; padding:12px 14px; margin-bottom:10px; page-break-inside:avoid; }
  .item { border-left:4px solid #ccc; padding:6px 10px; margin-top:6px; background:#FAFAFA; } .det { font-size:11.5px; color:#555; margin-top:3px; }
  .tag { font-size:10px; font-weight:700; text-transform:uppercase; } .muted { color:#888; font-size:11.5px; }
  .print-btn { position:fixed; bottom:20px; right:20px; background:#E8001D; color:#fff; border:none; border-radius:8px; padding:12px 20px; font-size:14px; cursor:pointer; }
  .footer { margin-top:30px; text-align:center; color:#aaa; font-size:11px; } @media print { .no-print { display:none; } body { padding:0; } }
</style></head><body>
<div class="topo"><div><h1>Relatório Geral de Auditoria</h1><div class="sub">${MESES[m - 1]} de ${ano}${parcial ? " — parcial (mês em andamento)" : ""} · gerado em ${new Date().toLocaleDateString("pt-BR")}</div></div>${logoSrc ? `<img src="${logoSrc}" style="height:46px"/>` : ""}</div>
<div class="stats">
  <div class="stat"><span>Auditorias</span><b>${auds.length}</b></div>
  <div class="stat"><span>Itens verificados</span><b>${itens.length}</b></div>
  <div class="stat"><span>Conformes</span><b style="color:#00B050">${conta("ok")}</b></div>
  <div class="stat"><span>Não conformes</span><b style="color:#E8001D">${conta("nok")}</b></div>
  <div class="stat"><span>Nota média</span><b>${media}%</b></div>
</div>
<h2>Relatórios semanais</h2>
${semanas.map(sem => { const r = semanais.find(x => x.id === sem.id); return `<div class="bloco"><b>Semana de ${fmtDate(sem.ini)} a ${fmtDate(sem.quinta)}</b> <span class="muted">· ${auditoriasDaSemana(auditorias, sem).length} auditoria(s)</span>
  ${r ? `<div class="det"><b>Conclusões:</b> ${esc(r.conclusoes)}</div>${r.recomendacoes ? `<div class="det"><b>Recomendações:</b> ${esc(r.recomendacoes)}</div>` : ""}${r.observacoes ? `<div class="det"><b>Observações:</b> ${esc(r.observacoes)}</div>` : ""}<div class="muted" style="margin-top:4px">Elaborado por ${esc(r.autorNome)} em ${fmtDate(r.data?.slice(0, 10))}</div>`
     : `<div class="det" style="color:#E8001D">Relatório semanal não elaborado.</div>`}</div>`; }).join("")}
<h2>Auditorias realizadas (${auds.length})</h2>
${auds.length === 0 ? '<div class="muted">Nenhuma auditoria registrada no mês.</div>' : auds.map(a => `<div class="bloco">
  <div style="display:flex;justify-content:space-between"><b>${esc(a.areaNome)}</b><b>${a.score}%</b></div>
  <div class="muted">${esc(a.auditorNome)} · ${fmtDate(a.data)}${a.cicloNome && a.cicloNome !== "—" ? ` · Ciclo ${esc(a.cicloNome)}` : ""}</div>
  ${itensDaAuditoria(a).map(it => { const [lbl, c] = RES[it.resp] || ["Sem resposta", "#888888"]; return `<div class="item" style="border-left-color:${c}"><span class="tag" style="color:${c}">${lbl}</span> — ${esc(it.q)}
    ${it.obs ? `<div class="det"><b>Detalhamento:</b> ${esc(it.obs)}</div>` : ""}${it.evidencia ? `<div class="det"><b>Evidência:</b> ${esc(it.evidencia)}</div>` : ""}${it.chamado ? `<div class="det"><b>Chamado / SharePoint:</b> ${esc(it.chamado)}</div>` : ""}</div>`; }).join("")}
  ${a.obs ? `<div class="det" style="margin-top:6px"><b>Observações gerais:</b> ${esc(a.obs)}</div>` : ""}
</div>`).join("")}
<div class="footer">Fast Sistemas Construtivos — Relatório Geral de Auditoria — Uso Interno</div>
<button class="print-btn no-print" onclick="window.print()">🖨 Imprimir / Salvar PDF</button>
</body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const win = window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  if (!win) alert("Permita pop-ups para gerar o relatório.");
}

function AuditoriasDoMes({ auditorias, semanais = [], podeElaborar, onSalvarSemanal }) {
  const [semanaAberta, setSemanaAberta] = useState(null);
  const [mes, setMes] = useState(() => {
    try { return sessionStorage.getItem("portal-fast-mes-relatorio") || new Date().toISOString().slice(0, 7); } catch { return new Date().toISOString().slice(0, 7); }
  });
  useEffect(() => { try { sessionStorage.setItem("portal-fast-mes-relatorio", mes); } catch {} }, [mes]);
  const [ano, m] = mes.split("-").map(Number);
  function mudarMes(delta) {
    const d = new Date(ano, m - 1 + delta, 1);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const doMes = auditorias.filter(a => (a.mes || a.data || "").slice(0, 7) === mes)
    .sort((a, b) => a.areaNome.localeCompare(b.areaNome) || (a.data || "").localeCompare(b.data || ""));
  const itensDe = itensDaAuditoria;
  const hojeStr = ymdLocal(new Date());
  const semanas = semanasDoMes(mes);
  const todos = doMes.flatMap(itensDe);
  const conta = r => todos.filter(i => i.resp === r).length;
  const RES = { ok: ["Conforme", F.green, F.greenDim], nok: ["Não conforme", F.red, F.redDim], na: ["N/A", F.gray4, F.gray6] };
  const navBtn = { background: "#fff", border: `1.5px solid ${F.gray6}`, borderRadius: 6, width: 32, height: 32, cursor: "pointer", fontSize: 15, color: F.gray3 };

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: F.charcoal, marginRight: 8 }}>Auditorias do mês</div>
        <button style={navBtn} onClick={() => mudarMes(-1)} title="Mês anterior">‹</button>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 900, textTransform: "uppercase", color: F.charcoal, minWidth: 160, textAlign: "center" }}>{MESES[m - 1]} / {ano}</div>
        <button style={navBtn} onClick={() => mudarMes(1)} title="Próximo mês">›</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 16 }}>
        <StatCard label="Auditorias" value={doMes.length} sub="realizadas no mês" accent={F.charcoal} />
        <StatCard label="Itens verificados" value={todos.length} sub="atividades auditadas" accent={F.blue} />
        <StatCard label="Conformes" value={conta("ok")} sub={todos.length ? `${Math.round(conta("ok") / todos.length * 100)}% dos itens` : "—"} accent={F.green} />
        <StatCard label="Não conformes" value={conta("nok")} sub="resultados encontrados" accent={F.red} />
        <StatCard label="N/A" value={conta("na")} sub="não se aplica" accent={F.gray5} />
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
          <div style={{ flex: 1, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: F.charcoal }}>Relatórios semanais</div>
          <Btn variant="ghost" onClick={() => gerarRelatorioGeralMes(mes, auditorias, semanais)}>📄 Gerar relatório geral do mês</Btn>
        </div>
        <div style={{ fontSize: 12, color: F.gray4, marginBottom: 12, lineHeight: 1.6 }}>
          O administrador elabora o relatório <strong>toda quinta-feira</strong>, com as auditorias feitas na semana (de sexta a quinta). No fim do mês, gere o relatório geral com todas as auditorias.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {semanas.length === 0 && <div style={{ fontSize: 12.5, color: F.gray4, padding: "6px 0" }}>Os relatórios semanais começam em 01/11/2026.</div>}
          {semanas.map(sem => {
            const rel = semanais.find(x => x.id === sem.id);
            const st = statusSemana(sem, rel, hojeStr);
            const n = auditoriasDaSemana(auditorias, sem).length;
            return (
              <div key={sem.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", border: `1px solid ${F.gray6}`, borderLeft: `4px solid ${st.cor}`, borderRadius: 7, padding: "8px 12px" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: F.charcoal }}>Quinta-feira, {fmtDate(sem.quinta)}</div>
                  <div style={{ fontSize: 11.5, color: F.gray4 }}>Auditorias de {fmtDate(sem.ini)} a {fmtDate(sem.quinta)} · {n} auditoria{n !== 1 ? "s" : ""}{rel ? ` · por ${rel.autorNome}` : ""}</div>
                </div>
                <Tag color={st.cor} bg={st.bg}>{st.label}</Tag>
                {(rel || (podeElaborar && sem.quinta <= hojeStr)) && (
                  <Btn variant={rel ? "ghost" : "primary"} onClick={() => setSemanaAberta(sem)}>{rel ? "Ver" : "Elaborar"}</Btn>
                )}
              </div>
            );
          })}
        </div>
      </Card>
      {semanaAberta && (
        <RelatorioSemanalModal
          semana={semanaAberta}
          auditorias={auditorias}
          relatorio={semanais.find(x => x.id === semanaAberta.id)}
          podeElaborar={podeElaborar}
          onClose={() => setSemanaAberta(null)}
          onSave={r => { onSalvarSemanal(r); setSemanaAberta(null); }}
        />
      )}

      {doMes.length === 0 ? (
        <Card><div style={{ textAlign: "center", padding: "32px 0", fontSize: 13, color: F.gray4 }}>Nenhuma auditoria registrada em {MESES[m - 1].toLowerCase()} de {ano}.</div></Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {doMes.map(a => (
            <Card key={a.id} style={{ border: `1.5px solid ${F.gray6}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 17, fontWeight: 900, color: F.charcoal }}>{a.areaNome}</div>
                  <div style={{ fontSize: 12, color: F.gray4, marginTop: 2 }}>{a.auditorNome} · {fmtDate(a.data)}{a.cicloNome && a.cicloNome !== "—" ? ` · Ciclo ${a.cicloNome}` : ""}</div>
                </div>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 900, color: scoreColor(a.score) }}>{a.score}%</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {itensDe(a).map((it, i) => {
                  const [lbl, c, bg] = RES[it.resp] || ["Sem resposta", F.gray4, F.gray6];
                  return (
                    <div key={i} style={{ border: `1px solid ${F.gray6}`, borderLeft: `4px solid ${c}`, borderRadius: 7, padding: "9px 12px", fontSize: 12, color: F.gray3, lineHeight: 1.5 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <div style={{ flex: 1, fontSize: 13, color: F.charcoal }}>{it.q}</div>
                        <Tag color={c} bg={bg}>{lbl}</Tag>
                      </div>
                      {it.obs && <div style={{ marginTop: 5, whiteSpace: "pre-wrap" }}><strong style={{ color: F.gray4 }}>Detalhamento: </strong>{it.obs}</div>}
                      {it.evidencia && <div style={{ marginTop: 3, whiteSpace: "pre-wrap" }}><strong style={{ color: F.gray4 }}>Evidência: </strong>{it.evidencia.startsWith("http") ? <a href={it.evidencia} target="_blank" rel="noreferrer" style={{ color: F.red, fontWeight: 600 }}>↗ Acessar documento</a> : it.evidencia}</div>}
                      {it.chamado && <div style={{ marginTop: 3 }}><strong style={{ color: F.gray4 }}>Chamado / SharePoint: </strong>{it.chamado}</div>}
                    </div>
                  );
                })}
                {a.obs && <div style={{ fontSize: 12, color: F.gray3, marginTop: 4, whiteSpace: "pre-wrap" }}><strong style={{ color: F.gray4 }}>Observações gerais: </strong>{a.obs}</div>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── DESPESAS FIXAS (planilha editável no banco, hash pa:despesas) ─
// Itens: meta → { abas: [{ id, nome, nLin, nCol, larg, merges }], estilos }
//        c:<aba>:<A1> → { v, st?, n? }  (valor, estilo, comentário)
const API_DESPESAS = "/api/state?doc=despesas";

function colNum(letras) { let n = 0; for (const ch of letras) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; }
function colLetra(n) { let s = ""; n++; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; }
function lerRef(ref) { const m = ref.match(/^([A-Z]+)(\d+)$/); return m ? { c: colNum(m[1]), r: Number(m[2]) - 1 } : null; }

// "R$ 4.152,80" → 4152.8 ; texto → null
function numeroBR(v) {
  const s = String(v ?? "").replace(/R\$|\s|%/g, "");
  if (!/^-?[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : /^-?\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s);
  return isNaN(n) ? null : n;
}

// Conta com + - * / e parênteses, sem eval
function calcular(expr) {
  const t = expr.replace(/\s+/g, ""); let i = 0;
  const fator = () => {
    if (t[i] === "(") { i++; const v = soma(); if (t[i] !== ")") throw new Error(); i++; return v; }
    if (t[i] === "-") { i++; return -fator(); }
    if (t[i] === "+") { i++; return fator(); }
    const m = t.slice(i).match(/^\d+(\.\d+)?/); if (!m) throw new Error();
    i += m[0].length; return Number(m[0]);
  };
  const produto = () => { let v = fator(); while (t[i] === "*" || t[i] === "/") { const op = t[i++]; const w = fator(); v = op === "*" ? v * w : v / w; } return v; };
  const soma = () => { let v = produto(); while (t[i] === "+" || t[i] === "-") { const op = t[i++]; const w = produto(); v = op === "+" ? v + w : v - w; } return v; };
  const v = soma(); if (i !== t.length) throw new Error(); return v;
}

// Fórmulas: =SOMA(A1:A5), =MÉDIA(...), =MÍNIMO(...), =MÁXIMO(...), referências e contas
const FUNCOES = {
  SOMA: l => l.reduce((a, b) => a + b, 0), SUM: l => l.reduce((a, b) => a + b, 0),
  MEDIA: l => l.length ? l.reduce((a, b) => a + b, 0) / l.length : 0, AVERAGE: l => l.length ? l.reduce((a, b) => a + b, 0) / l.length : 0,
  MINIMO: l => l.length ? Math.min(...l) : 0, MIN: l => l.length ? Math.min(...l) : 0,
  MAXIMO: l => l.length ? Math.max(...l) : 0, MAX: l => l.length ? Math.max(...l) : 0,
};
function avaliarFormula(formula, valorNum) {
  let e = formula.slice(1).toUpperCase().replace(/[ÉÍÁ]/g, ch => ({ É: "E", Í: "I", Á: "A" })[ch]).replace(/\$/g, "");
  const listaDe = arg => {
    const intervalo = arg.match(/^([A-Z]+\d+):([A-Z]+\d+)$/);
    if (intervalo) {
      const a = lerRef(intervalo[1]), b = lerRef(intervalo[2]), out = [];
      for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++)
        for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) { const n = valorNum(colLetra(c) + (r + 1)); if (n !== null) out.push(n); }
      return out;
    }
    if (/^[A-Z]+\d+$/.test(arg)) { const n = valorNum(arg); return n === null ? [] : [n]; }
    return [avaliarFormula("=" + arg, valorNum)];
  };
  for (let guarda = 0; guarda < 50; guarda++) {
    const m = e.match(/([A-Z]+)\(([^()]*)\)/);
    if (!m) break;
    const fn = FUNCOES[m[1]]; if (!fn) throw new Error();
    const args = m[2] ? m[2].split(/[;,]/).map(a => a.trim()).filter(Boolean) : [];
    e = e.slice(0, m.index) + `(${fn(args.flatMap(listaDe))})` + e.slice(m.index + m[0].length);
  }
  e = e.replace(/[A-Z]+\d+/g, ref => `(${valorNum(ref) ?? 0})`);
  return calcular(e);
}

function DespesasFixas({ podeEditar }) {
  const [itens, setItens] = useState(null);
  const [erro, setErro] = useState("");
  const [abaId, setAbaId] = useState(() => { try { return sessionStorage.getItem("portal-fast-aba-despesas") || "a1"; } catch { return "a1"; } });
  const [sel, setSel] = useState(null);
  const [rascunho, setRascunho] = useState("");
  const [notaRasc, setNotaRasc] = useState("");
  const [busca, setBusca] = useState("");
  const pend = useRef({}), timer = useRef(null), ultimaEscrita = useRef(0), barra = useRef(null), grade = useRef(null);

  useEffect(() => { try { sessionStorage.setItem("portal-fast-aba-despesas", abaId); } catch {} }, [abaId]);

  useEffect(() => {
    let parado = false;
    async function puxar() {
      const inicio = Date.now();
      try {
        const res = await fetch(API_DESPESAS, { cache: "no-store" });
        if (!res.ok || !(res.headers.get("content-type") || "").includes("json")) throw new Error(res.status === 503 ? "Banco não configurado." : "Não foi possível carregar a planilha.");
        const { items } = await res.json();
        // Ignora a leitura se houve edição local enquanto ela estava em andamento
        if (parado || inicio < ultimaEscrita.current || Object.keys(pend.current).length) return;
        setItens(items || {}); setErro("");
      } catch (e) { if (!parado) setErro(e.message); }
    }
    puxar();
    const t = setInterval(puxar, 30000);
    return () => { parado = true; clearInterval(t); };
  }, []);

  async function enviar() {
    const patches = pend.current; pend.current = {};
    if (!Object.keys(patches).length) return;
    try {
      const res = await fetch(API_DESPESAS, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patches }) });
      if (!res.ok) throw new Error();
      ultimaEscrita.current = Date.now(); setErro("");
    } catch {
      pend.current = { ...patches, ...pend.current };
      setErro("Falha ao salvar — tentando de novo...");
      timer.current = setTimeout(enviar, 5000);
    }
  }
  function gravar(patch) {
    setItens(it => { const n = { ...it }; Object.entries(patch).forEach(([k, v]) => { if (v === null) delete n[k]; else n[k] = v; }); return n; });
    Object.assign(pend.current, patch);
    ultimaEscrita.current = Date.now();
    clearTimeout(timer.current); timer.current = setTimeout(enviar, 500);
  }

  const meta = itens?.meta;
  const aba = meta?.abas.find(a => a.id === abaId) || meta?.abas[0];
  const chave = ref => `c:${aba.id}:${ref}`;
  const cel = ref => (itens && aba && itens[chave(ref)]) || null;

  // Valor exibido (fórmulas calculadas), com proteção contra referência circular
  const exibir = (ref, visitando = new Set()) => {
    const v = cel(ref)?.v ?? "";
    if (!String(v).startsWith("=")) return v;
    if (visitando.has(ref)) return "#CIRCULAR";
    visitando.add(ref);
    try {
      const n = avaliarFormula(v, r => { const x = exibir(r, new Set(visitando)); if (x === "#CIRCULAR" || x === "#ERRO") throw new Error(x); return typeof x === "number" ? x : numeroBR(x); });
      return isFinite(n) ? Math.round(n * 100) / 100 : "#ERRO";
    } catch (e) { return e.message === "#CIRCULAR" ? "#CIRCULAR" : "#ERRO"; }
  };
  const formatar = x => typeof x === "number" ? x.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : x;

  function selecionar(ref) {
    setSel(ref);
    setRascunho(cel(ref)?.v ?? "");
    setNotaRasc(cel(ref)?.n ?? "");
  }
  function confirmar(valor = rascunho) {
    if (!sel || !podeEditar) return;
    const atual = cel(sel) || {};
    if ((atual.v ?? "") === valor) return;
    const { v, ...resto } = atual;
    const novo = valor !== "" ? { ...resto, v: valor } : resto;
    gravar({ [chave(sel)]: Object.keys(novo).length ? novo : null });
  }
  function salvarNota() {
    if (!sel || !podeEditar) return;
    const atual = cel(sel) || {};
    if ((atual.n ?? "") === notaRasc) return;
    const { n, ...resto } = atual;
    const novo = notaRasc.trim() ? { ...resto, n: notaRasc } : resto;
    gravar({ [chave(sel)]: Object.keys(novo).length ? novo : null });
  }
  function mover(dr, dc) {
    const p = lerRef(sel || "A1");
    const r = Math.max(0, Math.min(aba.nLin - 1, p.r + dr)), c = Math.max(0, Math.min(aba.nCol - 1, p.c + dc));
    selecionar(colLetra(c) + (r + 1));
  }
  function teclaGrade(e) {
    if (!sel) return;
    const setas = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], Tab: [0, 1] };
    if (setas[e.key]) { e.preventDefault(); mover(...setas[e.key]); return; }
    if (!podeEditar) return;
    if (e.key === "Enter" || e.key === "F2") { e.preventDefault(); barra.current?.focus(); return; }
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); setRascunho(""); confirmar(""); return; }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { e.preventDefault(); setRascunho(e.key.toUpperCase()); barra.current?.focus(); }
  }
  function mudarEstrutura(campo, delta) {
    const abas = meta.abas.map(a => a.id !== aba.id ? a : campo === "nLin" ? { ...a, nLin: a.nLin + delta } : { ...a, nCol: a.nCol + delta, larg: [...a.larg, 90] });
    gravar({ meta: { ...meta, abas } });
  }

  // Grade só é redesenhada quando os dados ou a aba mudam (a seleção é feita por CSS)
  const corpo = useMemo(() => {
    if (!aba) return null;
    const inicio = {}, coberta = new Set();
    aba.merges.forEach(rg => {
      const [a, b] = rg.split(":").map(lerRef);
      inicio[colLetra(a.c) + (a.r + 1)] = { rs: b.r - a.r + 1, cs: b.c - a.c + 1 };
      for (let r = a.r; r <= b.r; r++) for (let c = a.c; c <= b.c; c++) if (r !== a.r || c !== a.c) coberta.add(colLetra(c) + (r + 1));
    });
    const linhas = [];
    for (let r = 0; r < aba.nLin; r++) {
      const tds = [<th key="n" style={{ position: "sticky", left: 0, zIndex: 1, background: F.offWhite, color: F.gray4, fontSize: 10, fontWeight: 600, border: `1px solid ${F.gray6}`, padding: "0 4px", textAlign: "center" }}>{r + 1}</th>];
      for (let c = 0; c < aba.nCol; c++) {
        const ref = colLetra(c) + (r + 1);
        if (coberta.has(ref)) continue;
        const item = itens[`c:${aba.id}:${ref}`];
        const est = item?.st !== undefined ? meta.estilos[item.st] || {} : {};
        const m = inicio[ref];
        const valor = formatar(exibir(ref));
        tds.push(
          <td key={ref} data-ref={ref} rowSpan={m?.rs} colSpan={m?.cs} title={item?.n ? `Comentário: ${item.n}` : undefined}
            style={{ position: "relative", border: `1px solid ${F.gray6}`, padding: "2px 5px", height: 22, fontSize: est.tam ? Math.round(est.tam * 1.05) : 12, fontWeight: est.b ? 700 : 400, fontStyle: est.i ? "italic" : "normal", color: est.cor || F.charcoal, background: est.fundo || "#fff", textAlign: est.al === "centerContinuous" ? "center" : est.al || (typeof exibir(ref) === "number" ? "right" : "left"), whiteSpace: est.q ? "pre-wrap" : "nowrap", overflow: "hidden", textOverflow: "ellipsis", verticalAlign: "middle", cursor: "cell", lineHeight: 1.3 }}>
            {valor}
            {item?.n && <span style={{ position: "absolute", top: 0, right: 0, borderTop: `7px solid ${F.red}`, borderLeft: "7px solid transparent" }} />}
          </td>
        );
      }
      linhas.push(<tr key={r}>{tds}</tr>);
    }
    return linhas;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, aba?.id, aba?.nLin, aba?.nCol]);

  const resultadosBusca = useMemo(() => {
    const q = busca.trim().toUpperCase();
    if (!itens || q.length < 2) return [];
    return Object.entries(itens).filter(([k, v]) => k.startsWith("c:") && String(v.v ?? "").toUpperCase().includes(q)).slice(0, 40)
      .map(([k, v]) => { const [, id, ref] = k.split(":"); return { id, ref, v: v.v, nome: meta.abas.find(a => a.id === id)?.nome }; });
  }, [busca, itens, meta]);

  if (erro && !itens) return <Card><div style={{ padding: 30, textAlign: "center", color: F.gray3, fontSize: 13 }}>{erro}</div></Card>;
  if (!itens) return <Card><div style={{ padding: 30, textAlign: "center", color: F.gray4, fontSize: 13 }}>Carregando planilha...</div></Card>;
  if (!meta) return <Card><div style={{ padding: 30, textAlign: "center", color: F.gray3, fontSize: 13 }}>A planilha ainda não foi carregada no banco.</div></Card>;

  const larguraTotal = 44 + aba.larg.reduce((a, b) => a + b, 0);
  const selItem = sel ? cel(sel) : null;
  const btnAba = ativo => ({ padding: "6px 12px", borderRadius: 6, border: `1px solid ${ativo ? F.red : F.gray6}`, background: ativo ? F.red : "#fff", color: ativo ? "#fff" : F.gray3, fontSize: 11.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Barlow',sans-serif" });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: F.gray4, flex: 1, minWidth: 220 }}>
          {meta.abas.length} abas · importado de “{meta.origem}”{podeEditar ? " · clique numa célula para editar; use “=” para fórmulas (ex.: =SOMA(B2:B10))" : ""}
          {erro && <span style={{ color: F.red, fontWeight: 700, marginLeft: 8 }}>{erro}</span>}
        </div>
        <div style={{ position: "relative" }}>
          <input style={{ ...fi, width: 240, padding: "6px 10px", fontSize: 12.5 }} value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar em todas as abas..." />
          {resultadosBusca.length > 0 && (
            <div style={{ position: "absolute", right: 0, top: 36, zIndex: 20, width: 380, maxHeight: 320, overflowY: "auto", background: "#fff", border: `1px solid ${F.gray6}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
              {resultadosBusca.map(x => (
                <div key={x.id + x.ref} onClick={() => { setAbaId(x.id); setBusca(""); setTimeout(() => selecionar(x.ref), 0); }} style={{ padding: "7px 10px", borderBottom: `1px solid ${F.gray6}`, cursor: "pointer", fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: F.charcoal }}>{x.nome} · {x.ref}</div>
                  <div style={{ color: F.gray3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.v}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 6, marginBottom: 10 }}>
        {meta.abas.map(a => <button key={a.id} style={btnAba(a.id === aba.id)} onClick={() => { setAbaId(a.id); setSel(null); }}>{a.nome}</button>)}
      </div>

      <Card style={{ padding: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderBottom: `1px solid ${F.gray6}`, flexWrap: "wrap" }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 14, minWidth: 54, color: F.charcoal }}>{sel || "—"}</div>
          <input ref={barra} style={{ ...fi, flex: 1, minWidth: 220, padding: "6px 10px", fontSize: 13 }} value={rascunho} disabled={!sel || !podeEditar}
            onChange={e => setRascunho(e.target.value)} onBlur={() => confirmar()}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); confirmar(); mover(1, 0); grade.current?.focus(); } if (e.key === "Escape") { setRascunho(cel(sel)?.v ?? ""); grade.current?.focus(); } }}
            placeholder={sel ? (podeEditar ? "Digite o valor ou uma fórmula começando com =" : "Somente leitura") : "Selecione uma célula"} />
          {podeEditar && <>
            <Btn variant="ghost" onClick={() => mudarEstrutura("nLin", 10)}>+ 10 linhas</Btn>
            <Btn variant="ghost" onClick={() => mudarEstrutura("nCol", 1)}>+ 1 coluna</Btn>
          </>}
        </div>
        {sel && (selItem?.n || podeEditar) && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 10px", borderBottom: `1px solid ${F.gray6}`, background: F.offWhite }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: F.gray4, textTransform: "uppercase", paddingTop: 6, minWidth: 80, fontFamily: "'Barlow Condensed',sans-serif" }}>Comentário</div>
            {podeEditar
              ? <textarea style={{ ...fi, flex: 1, minHeight: 34, padding: "5px 8px", fontSize: 12.5, resize: "vertical" }} value={notaRasc} onChange={e => setNotaRasc(e.target.value)} onBlur={salvarNota} placeholder="Comentário da célula (opcional)" />
              : <div style={{ fontSize: 12.5, color: F.charcoal, whiteSpace: "pre-wrap", paddingTop: 5 }}>{selItem?.n}</div>}
          </div>
        )}
        <style>{sel ? `td[data-ref="${sel}"]{outline:2px solid ${F.red};outline-offset:-2px;}` : ""}</style>
        <div ref={grade} tabIndex={0} onKeyDown={teclaGrade} style={{ overflow: "auto", maxHeight: "68vh", outline: "none" }}
          onClick={e => { const td = e.target.closest("td[data-ref]"); if (td) { confirmar(); selecionar(td.dataset.ref); grade.current?.focus(); } }}
          onDoubleClick={() => podeEditar && barra.current?.focus()}>
          <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: larguraTotal, fontFamily: "Arial, sans-serif" }}>
            <colgroup>
              <col style={{ width: 44 }} />
              {aba.larg.map((w, i) => <col key={i} style={{ width: w }} />)}
            </colgroup>
            <thead>
              <tr>
                <th style={{ position: "sticky", top: 0, left: 0, zIndex: 3, background: F.offWhite, border: `1px solid ${F.gray6}` }} />
                {aba.larg.map((_, i) => <th key={i} style={{ position: "sticky", top: 0, zIndex: 2, background: F.offWhite, color: F.gray4, fontSize: 10, fontWeight: 600, border: `1px solid ${F.gray6}`, height: 20 }}>{colLetra(i)}</th>)}
              </tr>
            </thead>
            <tbody>{corpo}</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── QUANTIDADE DE LANÇAMENTOS (dashboard) ────────────────────────
// Contagem semanal digitada (semana de sexta a quinta, como o relatório semanal),
// por grupo e empresa. Cada semana é um registro em db.lancamentos (id sem-<quinta>).
const CORES_TIPO = { ECO: "#C0504D", LOG: "#1F497D", MAX: "#00B0F0", Total: "#002060" };
const GRUPOS_LANCAMENTO = [
  { id: "despesas", nome: "Despesas Gerais ou Fixas", tipos: ["ECO", "LOG", "MAX"] },
  { id: "aprovacoes", nome: "Aprovações no SAP", tipos: ["ECO", "MAX"] },
  { id: "fretes", nome: "Lançamento de Fretes", tipos: ["ECO", "LOG"], tendencia: "LOG" },
  { id: "pn", nome: "Validações", tipos: ["Total"], tendencia: "Total" },
];

// Semanas do mês: cada quinta-feira do mês fecha uma semana que começa na sexta anterior
function semanasLancamento(mes) {
  const [ano, m] = mes.split("-").map(Number);
  const out = [];
  for (let dia = 1; dia <= new Date(ano, m, 0).getDate(); dia++) {
    const d = new Date(ano, m - 1, dia);
    if (d.getDay() !== 4) continue;
    const ini = new Date(ano, m - 1, dia - 6);
    const abrev = MESES[m - 1].slice(0, 3).toLowerCase();
    const rotulo = ini.getMonth() === d.getMonth()
      ? `${String(ini.getDate()).padStart(2, "0")}-${String(dia).padStart(2, "0")} (${abrev})`
      : `${String(ini.getDate()).padStart(2, "0")}/${String(ini.getMonth() + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
    out.push({ id: `sem-${ymdLocal(d)}`, ini: ymdLocal(ini), quinta: ymdLocal(d), rotulo });
  }
  return out;
}

// Reta de tendência (mínimos quadrados) sobre os pontos preenchidos
function tendenciaLinear(valores) {
  const pts = valores.map((y, x) => ({ x, y })).filter(p => p.y !== null);
  if (pts.length < 2) return valores.map(() => null);
  const n = pts.length, sx = pts.reduce((s, p) => s + p.x, 0), sy = pts.reduce((s, p) => s + p.y, 0);
  const sxy = pts.reduce((s, p) => s + p.x * p.y, 0), sxx = pts.reduce((s, p) => s + p.x * p.x, 0);
  const b = (n * sxy - sx * sy) / (n * sxx - sx * sx), a = (sy - b * sx) / n;
  return valores.map((_, x) => Math.round((a + b * x) * 10) / 10);
}

function QuantidadeLancamentos({ registros, podeEditar, onSalvar }) {
  // Quantidades começam recolhidas; a preferência fica salva neste navegador
  const [tabelaAberta, setTabelaAberta] = useState(() => { try { return localStorage.getItem("portal-fast-lancamentos-aberto") === "1"; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem("portal-fast-lancamentos-aberto", tabelaAberta ? "1" : "0"); } catch {} }, [tabelaAberta]);
  const [mes, setMes] = useState(() => { try { return sessionStorage.getItem("portal-fast-mes-lancamentos") || new Date().toISOString().slice(0, 7); } catch { return new Date().toISOString().slice(0, 7); } });
  useEffect(() => { try { sessionStorage.setItem("portal-fast-mes-lancamentos", mes); } catch {} }, [mes]);
  const [ano, m] = mes.split("-").map(Number);
  const mudarMes = delta => { const d = new Date(ano, m - 1 + delta, 1); setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };
  const semanas = semanasLancamento(mes);
  const valoresDe = sem => registros.find(r => r.id === sem.id)?.valores || {};
  const valor = (sem, k) => { const v = valoresDe(sem)[k]; return v === "" || v === undefined || v === null ? null : Number(v); };
  const soma = lista => lista.reduce((s, v) => s + (v || 0), 0);
  const totalGrupoSemana = (g, sem) => soma(g.tipos.map(t => valor(sem, `${g.id}-${t}`)));
  const totalMes = soma(semanas.flatMap(sem => GRUPOS_LANCAMENTO.map(g => totalGrupoSemana(g, sem))));
  const ultima = registros.filter(r => semanas.some(s => s.id === r.id) && r.atualizadoEm).sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))[0];

  const navBtn = { background: F.offWhite, border: `1px solid ${F.gray6}`, borderRadius: 6, padding: "4px 11px", cursor: "pointer", fontSize: 14, color: F.gray3 };
  const th = { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: F.gray4, padding: "7px 8px", borderBottom: `1.5px solid ${F.gray6}`, fontFamily: "'Barlow Condensed',sans-serif", whiteSpace: "nowrap", textAlign: "right" };
  const td = { padding: "4px 8px", borderBottom: `1px solid ${F.gray6}`, fontSize: 12.5, textAlign: "right" };

  return (
    <Card style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: F.charcoal }}>Quantidade de lançamentos</div>
          <div style={{ fontSize: 11.5, color: F.gray4 }}>Por semana, de sexta a quinta</div>
        </div>
        <button style={navBtn} onClick={() => mudarMes(-1)} title="Mês anterior">‹</button>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 800, textTransform: "uppercase", minWidth: 140, textAlign: "center", color: F.charcoal }}>{MESES[m - 1]} / {ano}</div>
        <button style={navBtn} onClick={() => mudarMes(1)} title="Próximo mês">›</button>
        <div style={{ background: F.charcoal, color: "#fff", borderRadius: 8, padding: "5px 12px", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 800 }}>Total do mês: {totalMes.toLocaleString("pt-BR")}</div>
      </div>

      {/* Gráficos por grupo: barras por empresa e tendência */}
      <div className="resp-grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
        {GRUPOS_LANCAMENTO.map(g => {
          const comDados = semanas.filter(sem => g.tipos.some(t => valor(sem, `${g.id}-${t}`) !== null));
          const tend = g.tendencia ? tendenciaLinear(comDados.map(sem => valor(sem, `${g.id}-${g.tendencia}`))) : [];
          const dados = comDados.map((sem, i) => ({ semana: sem.rotulo, ...Object.fromEntries(g.tipos.map(t => [t, valor(sem, `${g.id}-${t}`) ?? 0])), tendencia: tend[i] ?? null }));
          return (
            <div key={g.id} style={{ border: `1px solid ${F.gray6}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ background: F.red, color: "#fff", padding: "7px 12px", fontWeight: 800, fontSize: 15, fontFamily: "'Barlow',sans-serif" }}>{g.nome}</div>
              {dados.length === 0 ? <div style={{ padding: "40px 0", textAlign: "center", fontSize: 12.5, color: F.gray4 }}>Sem lançamentos neste mês.</div> : (
                <div style={{ height: 230, padding: "10px 6px 0" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={dados} margin={{ top: 18, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={F.gray6} />
                      <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      {g.tipos.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                      {g.tipos.map(t => (
                        <Bar key={t} dataKey={t} name={t === "Total" ? g.nome : t} fill={(g.cores || {})[t] || CORES_TIPO[t]} maxBarSize={48}>
                          <LabelList dataKey={t} position="top" style={{ fontSize: 11, fill: F.charcoal }} />
                        </Bar>
                      ))}
                      {g.tendencia && <Line dataKey="tendencia" name={`Linear (${g.tendencia === "Total" ? g.nome : g.tendencia})`} stroke={g.tendencia === "LOG" ? F.red : "#4472C4"} strokeDasharray="3 3" dot={false} strokeWidth={1.5} legendType="plainline" />}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Quantidades (tabela de preenchimento), recolhível */}
      <div style={{ marginTop: 16, borderTop: `1px solid ${F.gray6}`, paddingTop: 10 }}>
        <button onClick={() => setTabelaAberta(a => !a)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 8, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: F.charcoal }}>
          <span style={{ display: "inline-block", transform: tabelaAberta ? "rotate(90deg)" : "none", transition: "transform 0.15s", color: F.red }}>▶</span>
          Quantidades {tabelaAberta ? "(ocultar)" : podeEditar ? "(mostrar para preencher)" : "(mostrar)"}
        </button>
        {tabelaAberta && <>
        <div className="table-scroll" style={{ marginTop: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>Lançamento</th>
                {semanas.map(sem => <th key={sem.id} style={th} title={`${fmtDate(sem.ini)} a ${fmtDate(sem.quinta)}`}>{sem.rotulo}</th>)}
                <th style={th}>Total do mês</th>
              </tr>
            </thead>
            <tbody>
              {GRUPOS_LANCAMENTO.map(g => [
                <tr key={g.id}>
                  <td style={{ ...td, textAlign: "left", fontWeight: 800, color: F.charcoal, background: F.offWhite, fontFamily: "'Barlow Condensed',sans-serif", textTransform: "uppercase", letterSpacing: 0.3 }}>{g.nome}</td>
                  {semanas.map(sem => <td key={sem.id} style={{ ...td, background: F.offWhite, fontWeight: 800 }}>{totalGrupoSemana(g, sem).toLocaleString("pt-BR")}</td>)}
                  <td style={{ ...td, background: F.offWhite, fontWeight: 800 }}>{soma(semanas.map(sem => totalGrupoSemana(g, sem))).toLocaleString("pt-BR")}</td>
                </tr>,
                ...(g.tipos.length > 1 || podeEditar ? g.tipos.map(t => {
                  const k = `${g.id}-${t}`;
                  return (
                    <tr key={k}>
                      <td style={{ ...td, textAlign: "left", paddingLeft: 18, color: F.gray3, fontWeight: 700 }}>{t}</td>
                      {semanas.map(sem => (
                        <td key={sem.id} style={{ ...td, width: 96 }}>
                          {podeEditar
                            ? <input type="number" min="0" step="1" style={{ ...fi, padding: "3px 6px", fontSize: 12.5, textAlign: "right" }} value={valoresDe(sem)[k] ?? ""} placeholder="—"
                                onChange={e => onSalvar(sem.id, { ...valoresDe(sem), [k]: e.target.value === "" ? "" : Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
                            : (valor(sem, k) ?? "—").toLocaleString("pt-BR")}
                        </td>
                      ))}
                      <td style={td}>{soma(semanas.map(sem => valor(sem, k))).toLocaleString("pt-BR")}</td>
                    </tr>
                  );
                }) : []),
              ])}
            </tbody>
          </table>
        </div>
  
        </>}
      </div>
      {ultima?.atualizadoPor && <div style={{ fontSize: 11, color: F.gray4, marginTop: 10 }}>Última atualização: {ultima.atualizadoPor} em {new Date(ultima.atualizadoEm).toLocaleString("pt-BR")}</div>}
    </Card>
  );
}

function DetalheAtividade({ item }) {
  if (!item.objetivo && !item.controle && !item.metodologia) return null;
  const campos = [["Objetivo", item.objetivo], ["Controle interno", item.controle], ["Periodicidade", item.periodicidade], ["Metodologia", item.metodologia]].filter(c => c[1]);
  return (
    <div style={{ fontSize: 11, color: F.gray4, lineHeight: 1.5, marginTop: 4 }}>
      {campos.map(([l, v]) => <div key={l}><strong style={{ color: F.gray3, fontWeight: 600 }}>{l}:</strong> {v}</div>)}
    </div>
  );
}

// O prazo é a data prevista de conclusão; sem ela, vale a data prevista
function statusCronograma(r, hoje) {
  const prazo = r?.previstaConclusao || r?.prevista;
  if (r?.realizada) return prazo && r.realizada > prazo
    ? { key: "realizado", label: "Realizado c/ atraso", cor: F.amber, bg: F.amberDim }
    : { key: "realizado", label: "Realizado", cor: F.green, bg: F.greenDim };
  if (prazo && prazo < hoje) return { key: "atrasado", label: "Atrasado", cor: F.red, bg: F.redDim };
  if (prazo) return { key: "pendente", label: "Previsto", cor: F.blue, bg: F.blueDim };
  return { key: "sem-data", label: "Sem data", cor: F.gray4, bg: F.gray6 };
}

// Até três responsáveis por atividade
const CAMPOS_RESPONSAVEL = ["responsavelId", "responsavel2Id", "responsavel3Id"];

// Último mês coberto pelos ciclos (padrão: dez/2027)
const ultimoMesCiclos = ciclos => (ciclos || []).reduce((max, c) => (c.fim || "").slice(0, 7) > max ? c.fim.slice(0, 7) : max, "2027-12");

// Meses de "mes" até "ate" (inclusive), no formato AAAA-MM
function mesesAte(mes, ate) {
  const meses = [];
  let [a, m] = mes.split("-").map(Number);
  while (`${a}-${String(m).padStart(2, "0")}` <= ate && meses.length < 60) {
    meses.push(`${a}-${String(m).padStart(2, "0")}`);
    m++; if (m > 12) { m = 1; a++; }
  }
  return meses;
}

// somenteDe: id do auditor — mostra só as atividades em que ele é um dos responsáveis
function CronogramaAuditoria({ dados, usuarios, auditorias, podeEditar, onChange, onAuditar, onRepetirResponsaveis, somenteDe, bonus }) {
  const GRUPOS = CRONOGRAMA_ITENS.map(g => ({ ...g, itens: g.itens.filter(i => i.bonus === !!bonus) })).filter(g => g.itens.length);
  const [mes, setMes] = useState(() => {
    try { return sessionStorage.getItem("portal-fast-mes-cronograma") || new Date().toISOString().slice(0, 7); } catch { return new Date().toISOString().slice(0, 7); }
  });
  useEffect(() => { try { sessionStorage.setItem("portal-fast-mes-cronograma", mes); } catch {} }, [mes]);
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroResp, setFiltroResp] = useState("");
  const hoje = new Date().toISOString().split("T")[0];
  const folha = bonus ? "bonus" : mes;
  const [ano, m] = mes.split("-").map(Number);
  const doMes = dados[folha] || {};
  const responsaveis = usuarios.filter(u => ["auditor", "administrador"].includes(u.perfil));

  function mudarMes(delta) {
    const d = new Date(ano, m - 1 + delta, 1);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const ehMinha = item => !somenteDe || CAMPOS_RESPONSAVEL.some(c => doMes[item.id]?.[c] === somenteDe);
  const todos = GRUPOS.flatMap(g => g.itens.filter(ehMinha).map(i => statusCronograma(doMes[i.id], hoje).key));
  const cont = k => todos.filter(x => x === k).length;
  const pct = todos.length ? Math.round(cont("realizado") / todos.length * 100) : 0;

  const passaFiltro = item => {
    const r = doMes[item.id];
    if (!ehMinha(item)) return false;
    if (filtroStatus && statusCronograma(r, hoje).key !== filtroStatus) return false;
    if (filtroResp && !CAMPOS_RESPONSAVEL.some(c => r?.[c] === filtroResp)) return false;
    return true;
  };

  const inp = { ...fi, padding: "5px 8px", fontSize: 12.5 };
  const navBtn = { background: "#fff", border: `1.5px solid ${F.gray6}`, borderRadius: 6, width: 32, height: 32, cursor: "pointer", fontSize: 15, color: F.gray3 };

  // Ordem por data: as atividades seguem a data prevista (sem data vão para o fim).
  // A ordem só é refeita ao sair do campo de data, para a linha não pular enquanto se digita.
  const [modo, setModo] = useState("data");
  const [versaoOrdem, setVersaoOrdem] = useState(0);
  const dataDe = i => doMes[i.id]?.prevista || doMes[i.id]?.previstaConclusao || "";
  const assinatura = podeEditar ? "" : GRUPOS.flatMap(g => g.itens.map(dataDe)).join(",");
  const chaveOrdem = `${folha}|${versaoOrdem}|${assinatura}`;
  const ordemRef = useRef({ chave: null, lista: [] });
  if (ordemRef.current.chave !== chaveOrdem) {
    const lista = GRUPOS.flatMap((g, gi) => g.itens.map((item, ii) => ({ item, g, data: dataDe(item), gi, ii })));
    lista.sort((a, b) => (a.data || "9999").localeCompare(b.data || "9999") || a.gi - b.gi || a.ii - b.ii);
    ordemRef.current = { chave: chaveOrdem, lista };
  }
  const reordenar = () => setVersaoOrdem(v => v + 1);
  const rotuloDia = d => d ? `${new Date(d + "T00:00").toLocaleDateString("pt-BR", { weekday: "long" })}, ${fmtDate(d)}` : "Sem data programada";
  const cabecalho = (chave, titulo, extra) => (
    <tr key={chave}>
      <td colSpan={5} style={{ background: F.charcoal, color: "#fff", padding: "7px 10px", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {titulo} <span style={{ color: F.gray5, fontWeight: 600, marginLeft: 6 }}>{extra}</span>
      </td>
    </tr>
  );

  const linha = (item, g, mostrarArea) => {
    const r = doMes[item.id] || {};
    const st = statusCronograma(r, hoje);
    const set = (campo, valor) => onChange(folha, item.id, campo, valor);
    return (
      <tr key={item.id} style={{ borderBottom: `1px solid ${F.gray6}` }}>
        <td style={{ padding: "8px 10px", fontSize: 12.5, color: F.charcoal, lineHeight: 1.45, overflowWrap: "anywhere", verticalAlign: "top" }}>
          {mostrarArea && <div style={{ marginBottom: 4 }}><Tag>{g.cat}</Tag></div>}
          {item.texto}
          <DetalheAtividade item={item} />
        </td>
        <td style={{ padding: "8px 6px", verticalAlign: "top" }}>
          {podeEditar ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {CAMPOS_RESPONSAVEL.map((campo, n) => (
                <select key={campo} style={{ ...inp, color: n === 0 || r[campo] ? F.charcoal : F.gray4 }} value={r[campo] || ""} onChange={e => set(campo, e.target.value)}>
                  <option value="">{n === 0 ? "—" : `+ ${n + 1}º resp.`}</option>
                  {responsaveis.filter(u => !CAMPOS_RESPONSAVEL.some(c => c !== campo && r[c] === u.id)).map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              ))}
            </div>
          ) : <span style={{ fontSize: 12.5, color: F.gray3 }}>{CAMPOS_RESPONSAVEL.map(c => usuarios.find(u => u.id === r[c])?.nome).filter(Boolean).join(", ") || "—"}</span>}
        </td>
        <td style={{ padding: "8px 6px", verticalAlign: "top" }}>
          {[["prevista", "Prevista"], ["previstaConclusao", "Conclusão prevista"], ["realizada", "Realizada"]].map(([campo, rotulo]) => (
            <div key={campo} style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: F.gray4, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "'Barlow Condensed',sans-serif" }}>{rotulo}</div>
              {podeEditar
                ? <input type="date" style={{ ...inp, padding: "3px 6px" }} value={r[campo] || ""} min={campo === "previstaConclusao" ? r.prevista || undefined : undefined} onChange={e => set(campo, e.target.value)} onBlur={campo === "realizada" ? undefined : reordenar} />
                : <span style={{ fontSize: 12.5 }}>{r[campo] ? fmtDate(r[campo]) : "—"}</span>}
            </div>
          ))}
        </td>
        <td style={{ padding: "8px 6px", verticalAlign: "top" }}>
          <Tag color={st.cor} bg={st.bg}>{st.label}</Tag>
          {onAuditar && (
            <button onClick={() => onAuditar(g.id, item.id, folha)} style={{ display: "block", marginTop: 6, background: F.red, color: "#fff", border: "none", borderRadius: 5, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'Barlow',sans-serif", whiteSpace: "nowrap" }}>◎ Auditar</button>
          )}
          {r.auditoriaId && (() => {
            const aud = (auditorias || []).find(a => a.id === r.auditoriaId);
            const res = { ok: ["Conforme", F.green], nok: ["Não conforme", F.red], na: ["N/A", F.gray4] }[r.resultado];
            return <div style={{ fontSize: 10.5, color: res?.[1] || F.gray4, fontWeight: 700, marginTop: 4 }} title={aud ? `Auditoria de ${fmtDate(aud.data)} · ${aud.auditorNome}` : "Auditoria removida"}>◎ {res?.[0] || "Auditada"}</div>;
          })()}
        </td>
        <td style={{ padding: "8px 10px 8px 6px", verticalAlign: "top" }}>
          {podeEditar
            ? <textarea style={{ ...inp, resize: "vertical", minHeight: 64, lineHeight: 1.4 }} value={r.obs || ""} onChange={e => set("obs", e.target.value)} placeholder="Observação..." />
            : <span style={{ fontSize: 12.5, color: F.gray3, overflowWrap: "anywhere" }}>{r.obs || "—"}</span>}
        </td>
      </tr>
    );
  };

  // Linhas por data: um cabeçalho para cada dia, na ordem congelada
  const linhasPorData = () => {
    const visiveis = ordemRef.current.lista.filter(x => passaFiltro(x.item));
    const out = [];
    visiveis.forEach((x, i) => {
      if (i === 0 || visiveis[i - 1].data !== x.data) {
        const n = visiveis.filter(y => y.data === x.data).length;
        out.push(cabecalho(`dia-${x.data || "sem"}`, rotuloDia(x.data), `${n} atividade${n !== 1 ? "s" : ""}`));
      }
      out.push(linha(x.item, x.g, true));
    });
    return out;
  };

  const btnModo = ativo => ({ padding: "5px 12px", borderRadius: 6, border: "none", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "'Barlow',sans-serif", background: ativo ? F.red : F.offWhite, color: ativo ? "#fff" : F.gray3 });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        {bonus ? (
          <div style={{ fontSize: 12.5, color: F.gray3, lineHeight: 1.6, maxWidth: 560 }}>Auditorias pontuais, sem data padrão e fora do cronograma mensal. O administrador define responsáveis e datas quando a auditoria for programada.</div>
        ) : <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button style={navBtn} onClick={() => mudarMes(-1)} title="Mês anterior">‹</button>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 900, textTransform: "uppercase", color: F.charcoal, minWidth: 170, textAlign: "center" }}>
            {MESES[m - 1]} / {ano}
          </div>
          <button style={navBtn} onClick={() => mudarMes(1)} title="Próximo mês">›</button>
        </div>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 4 }}>
            <button style={btnModo(modo === "data")} onClick={() => { setModo("data"); reordenar(); }}>📅 Por data</button>
            <button style={btnModo(modo === "area")} onClick={() => setModo("area")}>☰ Por área</button>
          </div>
          <select style={{ ...inp, width: "auto" }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="">Todos os status</option>
            <option value="sem-data">Sem data</option>
            <option value="pendente">Previsto</option>
            <option value="atrasado">Atrasado</option>
            <option value="realizado">Realizado</option>
          </select>
          {podeEditar && !bonus && onRepetirResponsaveis && <Btn variant="ghost" onClick={() => onRepetirResponsaveis(mes)}>↻ Repetir responsáveis nos meses seguintes</Btn>}
          {!somenteDe && <select style={{ ...inp, width: "auto" }} value={filtroResp} onChange={e => setFiltroResp(e.target.value)}>
            <option value="">Todos os responsáveis</option>
            {responsaveis.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 16 }}>
        <StatCard label={bonus ? "Auditorias bônus" : "Itens no mês"} value={todos.length} sub={`${pct}% concluído`} accent={F.charcoal} />
        <StatCard label="Realizados" value={cont("realizado")} sub="com data realizada" accent={F.green} />
        <StatCard label="Previstos" value={cont("pendente")} sub="dentro do prazo" accent={F.blue} />
        <StatCard label="Atrasados" value={cont("atrasado")} sub="prazo de conclusão passou" accent={F.red} />
        <StatCard label="Sem data" value={cont("sem-data")} sub="falta planejar" accent={F.gray5} />
      </div>

      <Card style={{ padding: 0 }}>
        <div className="table-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: 760 }}>
            <colgroup>
              <col />
              <col style={{ width: 150 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 112 }} />
              <col style={{ width: 170 }} />
            </colgroup>
            <thead>
              <tr>
                {["Atividade", "Responsável", "Datas", "Status", "Observações"].map(c => (
                  <th key={c} style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: F.gray4, padding: "10px 10px", textAlign: "left", borderBottom: `1.5px solid ${F.gray6}`, fontFamily: "'Barlow Condensed',sans-serif", whiteSpace: "nowrap" }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modo === "data" ? linhasPorData() : GRUPOS.map(g => {
                const itens = g.itens.filter(passaFiltro);
                if (!itens.length) return null;
                const feitos = g.itens.filter(i => doMes[i.id]?.realizada).length;
                return [cabecalho(g.cat, g.cat, `${feitos}/${g.itens.length}`), ...itens.map(item => linha(item, g, false))];
              })}
            </tbody>
          </table>
          {GRUPOS.every(g => !g.itens.some(passaFiltro)) && (
            <div style={{ textAlign: "center", padding: "36px 0", fontSize: 13, color: F.gray4 }}>{somenteDe && !todos.length ? (bonus ? "Nenhuma auditoria bônus com o seu nome." : "Nenhuma atividade programada com o seu nome neste mês.") : "Nenhum item com esses filtros."}</div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// DADOS
// ══════════════════════════════════════════════════════════════════
const USUARIOS_PADRAO = [
  { id: "u-admin", nome: "Administrador", ini: "AD", email: "admin@fastdrywall.com.br", perfil: "administrador", areaId: "", areaNome: "—" },
  { id: "u-leticia-werneck", nome: "Letícia Werneck", ini: "LW", email: "leticia.werneck@cscempresarial.com.br", perfil: "administrador", areaId: "", areaNome: "—" },
  // Time de auditoria (e-mail pendente: sem e-mail o login não funciona)
  { id: "u-gustavo-silva", nome: "Gustavo Silva", ini: "GS", email: "gustavo.silva@cscempresarial.com.br", perfil: "auditor", areaId: "", areaNome: "—" },
  { id: "u-gustavo-queiroz", nome: "Gustavo Queiroz", ini: "GQ", email: "gustavo.santos@fastdrywall.com.br", perfil: "auditor", areaId: "", areaNome: "—" },
  { id: "u-julianna-vianna", nome: "Julianna Vianna", ini: "JV", email: "juliana.viana@cscempresarial.com.br", perfil: "auditor", areaId: "", areaNome: "—" },
  { id: "u-rodrigo-monsores", nome: "Rodrigo Monsores", ini: "RM", email: "rodrigo.monsores@cscempresarial.com.br", perfil: "auditor", areaId: "", areaNome: "—" },
  { id: "u-thauan-simas", nome: "Thauan Simas", ini: "TS", email: "thauan.simas@cscempresarial.com.br", perfil: "auditor", areaId: "", areaNome: "—" },
  { id: "u-arthur-villarge", nome: "Arthur Villarge", ini: "AV", email: "arthur.villarde@cscempresarial.onmicrosoft.com", perfil: "auditor", areaId: "", areaNome: "—" },
  { id: "u-lorraine-silva", nome: "Lorraine Silva", ini: "LS", email: "lorraine.paulo@cscempresarial.com.br", perfil: "auditor", areaId: "", areaNome: "—" },
  { id: "u-gilberto", nome: "Gilberto", ini: "GI", email: "gilberto.souza@cscempresarial.com.br", perfil: "administrador", areaId: "", areaNome: "—" },
  { id: "u-guilherme", nome: "Guilherme", ini: "GU", email: "guilherme@fastdrywall.onmicrosoft.com", perfil: "administrador", areaId: "", areaNome: "—" },
  { id: "u-area-processos", nome: "Área de Processos", ini: "AP", email: "processos@fastdrywall.com.br", perfil: "area-processos", areaId: "", areaNome: "—" },
  { id: "u-gestor", nome: "Gestor da Área", ini: "GA", email: "gestor@fastdrywall.com.br", perfil: "gestor", areaId: "", areaNome: "—" },
];

const EMAILS_USUARIOS = {
  "u-thauan-simas": "thauan.simas@cscempresarial.com.br",
  "u-gustavo-silva": "gustavo.silva@cscempresarial.com.br",
  "u-julianna-vianna": "juliana.viana@cscempresarial.com.br",
  "u-arthur-villarge": "arthur.villarde@cscempresarial.onmicrosoft.com",
  "u-rodrigo-monsores": "rodrigo.monsores@cscempresarial.com.br",
  "u-guilherme": "guilherme@fastdrywall.onmicrosoft.com",
  "u-gustavo-queiroz": "gustavo.santos@fastdrywall.com.br",
  "u-gilberto": "gilberto.souza@cscempresarial.com.br",
};
// Completa campos que faltam e restaura usuários e ciclos padrão
function normalizarDb(dados) {
  const base = { areas: [], processos: [], auditorias: [], planos: [], ciclos: [], usuarios: [], modulos: [], notificacoes: [], consolidacoes: [], relatoriosSemanais: [], lancamentos: [], cronograma: {}, ...dados };
  // Perfil "auditor-lider" foi unificado em "auditor"; login é só por e-mail
  base.usuarios = base.usuarios
    .filter(u => !["u-auditor-lider", "u-comite", "u-auditor"].includes(u.id))
    .map(({ senhaHash, trocarSenha, ...u }) => u.perfil === "auditor-lider" ? { ...u, perfil: "auditor" } : u)
    // Gilberto e Guilherme entraram como auditores e passaram a administradores
    .map(u => ["u-gilberto", "u-guilherme"].includes(u.id) && u.perfil === "auditor" ? { ...u, perfil: "administrador" } : u)
    .map(u => !u.email && EMAILS_USUARIOS[u.id] ? { ...u, email: EMAILS_USUARIOS[u.id] } : u);
  base.planos = base.planos.map(({ aguardaComite, elaborado, ...p }) => aguardaComite ? { ...p, aprovacao: "pendente" } : p);
  USUARIOS_PADRAO.forEach(u => {
    if (!base.usuarios.find(x => x.id === u.id)) base.usuarios = [...base.usuarios, u];
  });
  // Ciclos de teste anteriores aos ciclos mensais (até out/2026) e sem auditoria saem
  base.ciclos = base.ciclos.filter(c => CICLOS_PADRAO.some(p => p.id === c.id) || !(c.fim && c.fim < "2026-11-01") || base.auditorias.some(a => a.cicloNome === c.nome));
  CICLOS_PADRAO.forEach(c => {
    if (!base.ciclos.find(x => x.id === c.id || x.nome === c.nome)) base.ciclos = [...base.ciclos, c];
  });
  return base;
}

// ── BANCO COMPARTILHADO (Upstash Redis via /api/state) ───────────
// O localStorage continua como cache: a tela abre na hora e funciona sem rede.
// Cada registro é um item próprio no banco, para que duas pessoas editando
// coisas diferentes ao mesmo tempo não se sobrescrevam:
//   o:<coleção>                    → ordem dos ids
//   l:<coleção>:<id>               → um registro
//   m:cronograma:<mês>|<atividade> → uma linha do cronograma
const COLECOES = ["areas", "processos", "auditorias", "planos", "ciclos", "usuarios", "modulos", "notificacoes", "consolidacoes", "relatoriosSemanais", "lancamentos"];
const SINC_KEY = "portal-fast-sincronizado";
const BACKUP_KEY = "portal-fast-backup-antes-do-banco";

function encodeDb(db) {
  const out = {};
  COLECOES.forEach(c => {
    const arr = db[c] || [];
    out[`o:${c}`] = arr.map(x => x.id);
    arr.forEach(x => { out[`l:${c}:${x.id}`] = x; });
  });
  Object.entries(db.cronograma || {}).forEach(([mes, itens]) =>
    Object.entries(itens || {}).forEach(([id, r]) => { out[`m:cronograma:${mes}|${id}`] = r; }));
  return out;
}

function decodeDb(items) {
  const db = { cronograma: {} };
  COLECOES.forEach(c => {
    const prefixo = `l:${c}:`;
    const ids = [...(items[`o:${c}`] || [])];
    // Registros que outra pessoa criou ao mesmo tempo podem não estar na ordem salva
    Object.keys(items).forEach(k => {
      if (k.startsWith(prefixo) && !ids.includes(k.slice(prefixo.length))) ids.push(k.slice(prefixo.length));
    });
    db[c] = ids.map(id => items[prefixo + id]).filter(Boolean);
  });
  Object.entries(items).forEach(([k, r]) => {
    if (!k.startsWith("m:cronograma:")) return;
    const [mes, id] = k.slice("m:cronograma:".length).split("|");
    db.cronograma[mes] = { ...db.cronograma[mes], [id]: r };
  });
  return db;
}

function diffItens(antes, depois) {
  const patch = {};
  Object.keys(depois).forEach(k => { if (JSON.stringify(antes[k]) !== JSON.stringify(depois[k])) patch[k] = depois[k]; });
  Object.keys(antes).forEach(k => { if (!(k in depois)) patch[k] = null; });
  return patch;
}

// Primeira conexão de um navegador: soma ao banco o que só existia nele.
// O que o banco já tem prevalece.
function somarLocal(servidor, local) {
  const db = { ...servidor, cronograma: { ...servidor.cronograma } };
  COLECOES.forEach(c => {
    const ids = new Set((servidor[c] || []).map(x => x.id));
    db[c] = [...(servidor[c] || []), ...(local[c] || []).filter(x => x?.id && !ids.has(x.id))];
  });
  Object.entries(local.cronograma || {}).forEach(([mes, itens]) => {
    db.cronograma[mes] = { ...itens, ...db.cronograma[mes] };
  });
  return db;
}

// Status: "carregando" | "online" | "offline" | "local" (banco não configurado)
function useBancoCompartilhado(db, setDb) {
  const [status, setStatus] = useState("carregando");
  const ref = useRef({ last: null, pending: {}, timer: null, lastWrite: 0, marcarSinc: false, enviar: () => {} });
  ref.current.db = db;

  useEffect(() => {
    const s = ref.current;
    let parado = false;

    async function enviar() {
      s.timer = null;
      const patches = s.pending;
      s.pending = {};
      if (!Object.keys(patches).length) return;
      try {
        const res = await fetch("/api/state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patches }) });
        if (!res.ok) throw new Error(String(res.status));
        s.lastWrite = Date.now();
        if (s.marcarSinc) { try { localStorage.setItem(SINC_KEY, "1"); } catch {} s.marcarSinc = false; }
        setStatus("online");
      } catch {
        // Devolve para a fila e tenta de novo depois
        s.pending = { ...patches, ...s.pending };
        setStatus("offline");
        s.timer = setTimeout(enviar, 10000);
      }
    }
    s.enviar = () => { clearTimeout(s.timer); s.timer = setTimeout(enviar, 400); };

    async function puxar() {
      const inicio = Date.now();
      try {
        const res = await fetch("/api/state", { cache: "no-store" });
        if (res.status === 503 || !(res.headers.get("content-type") || "").includes("json")) { setStatus("local"); return; }
        if (!res.ok) throw new Error(String(res.status));
        const items = (await res.json()).items || {};
        // Ignora a leitura se houve edição local enquanto ela estava em andamento
        if (parado || inicio < s.lastWrite || Object.keys(s.pending).length) return;

        let primeira = false;
        try { primeira = !localStorage.getItem(SINC_KEY); } catch {}
        if (primeira) {
          try { if (!localStorage.getItem(BACKUP_KEY)) localStorage.setItem(BACKUP_KEY, JSON.stringify(s.db)); } catch {}
        }
        const servidor = decodeDb(items);
        const novo = normalizarDb(primeira ? somarLocal(servidor, s.db) : servidor);
        const proximo = encodeDb(novo);

        const patch = diffItens(items, proximo);
        s.last = proximo;
        if (Object.keys(patch).length) {
          s.pending = { ...s.pending, ...patch };
          s.marcarSinc = primeira;
          s.enviar();
        } else if (primeira) {
          try { localStorage.setItem(SINC_KEY, "1"); } catch {}
        }
        if (Object.keys(diffItens(encodeDb(s.db), proximo)).length) setDb(novo);
        setStatus("online");
      } catch {
        setStatus(st => st === "local" ? st : "offline");
      }
    }

    puxar();
    const intervalo = setInterval(puxar, 15000);
    window.addEventListener("focus", puxar);
    return () => { parado = true; clearInterval(intervalo); window.removeEventListener("focus", puxar); clearTimeout(s.timer); };
  }, [setDb]);

  // Cada alteração local vira um patch para o banco
  useEffect(() => {
    const s = ref.current;
    if (!s.last) return;
    const proximo = encodeDb(db);
    const patch = diffItens(s.last, proximo);
    if (!Object.keys(patch).length) return;
    s.last = proximo;
    s.lastWrite = Date.now();
    s.pending = { ...s.pending, ...patch };
    s.enviar();
  }, [db]);

  return status;
}

// ══════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════
export default function App() {
  const [view, setView] = useState(() => {
    try { return sessionStorage.getItem("portal-fast-view") || "dashboard"; } catch { return "dashboard"; }
  });
  useEffect(() => { try { sessionStorage.setItem("portal-fast-view", view); } catch {} }, [view]);
  const [db, setDb] = useState(() => {
    try {
      const salvo = localStorage.getItem("portal-fast-db-v2");
      return normalizarDb(salvo ? JSON.parse(salvo) : {});
    } catch {
      return normalizarDb({});
    }
  });
  const nuvem = useBancoCompartilhado(db, setDb);

  useEffect(() => {
    try { localStorage.setItem("portal-fast-db-v2", JSON.stringify(db)); } catch {}
  }, [db]);
  const [usuarioLogado, setUsuarioLogado] = useState(() => {
    try {
      const id = sessionStorage.getItem(SESSAO_KEY);
      const u = id && db.usuarios.find(x => x.id === id);
      return u || null;
    } catch { return null; }
  });
  useEffect(() => {
    try {
      if (usuarioLogado) sessionStorage.setItem(SESSAO_KEY, usuarioLogado.id);
      else sessionStorage.removeItem(SESSAO_KEY);
    } catch {}
  }, [usuarioLogado]);
  const [toast, setToast] = useState(null);
  const [modals, setModals] = useState({});
  const [audStep, setAudStep] = useState(1);
  const [audForm, setAudForm] = useState({});
  const [checklist, setChecklist] = useState([]);

  const [notifOpen, setNotifOpen] = useState(false);
  const [idsLidos, setIdsLidos] = useState(new Set());
  const [idsNovos, setIdsNovos] = useState(new Set());
  const [historicoPlanId, setHistoricoPlanId] = useState(null);
  const [justificandoPlano, setJustificandoPlano] = useState(null);
  const [cienciaAuditoriaId, setCienciaAuditoriaId] = useState(null);
  const [relatorioFinalAudId, setRelatorioFinalAudId] = useState(null);
  const [consolidandoPar, setConsolidandoPar] = useState(null);
  const [cronogramaView, setCronogramaView] = useState("calendario");
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const onResize = () => { setIsMobile(window.innerWidth <= 768); if (window.innerWidth > 768) setSidebarOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── AUTOMAÍSCULO GLOBAL ──
  useEffect(() => {
    const SKIP_TYPES = new Set(["email","url","date","password","number","tel","time","month","week","color","file","range","search"]);
    const inputSetter  = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,  "value")?.set;
    const textaSetter  = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,"value")?.set;
    function handleInput(e) {
      const el = e.target;
      const tag = el.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA") return;
      if (SKIP_TYPES.has((el.type || "").toLowerCase())) return;
      const ph = (el.placeholder || "").toLowerCase();
      const val = el.value || "";
      // não converter URLs e campos de link
      if (ph.includes("http") || ph.includes("link") || val.startsWith("http")) return;
      const upper = val.toUpperCase();
      if (upper === val) return;
      const selS = el.selectionStart, selE = el.selectionEnd;
      if (tag === "INPUT"    && inputSetter) { inputSetter.call(el, upper); }
      else if (tag === "TEXTAREA" && textaSetter) { textaSetter.call(el, upper); }
      else { el.value = upper; }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      try { el.setSelectionRange(selS, selE); } catch(_) {}
    }
    document.addEventListener("input", handleInput, true);
    return () => document.removeEventListener("input", handleInput, true);
  }, []);
  const [diaCalendario, setDiaCalendario] = useState(null);
  const [calMes, setCalMes] = useState(() => { const d = new Date(); return { ano: d.getFullYear(), mes: d.getMonth() }; });
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


  // ── LOGIN GUARD ──
  if (!usuarioLogado) {
    return (
      <LoginScreen
        carregando={nuvem === "carregando"}
        usuarios={db.usuarios}
        onLogin={u => { setUsuarioLogado(u); setView("dashboard"); }}
      />
    );
  }
  const perfil = usuarioLogado.perfil;

  // ── ÁREA GUARD (gestor sem área definida) ──
  if (perfil === "gestor" && !usuarioLogado.areaId) {
    return (
      <AreaSelectionScreen
        areas={AREAS_CRONOGRAMA}
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

    const confPorArea = AREAS_CRONOGRAMA.filter(a => !a.naoAuditada && !a.noa).map(a => {
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
    <div class="stat-value">${AREAS_CRONOGRAMA.filter(a => !a.naoAuditada && !a.noa).length || "—"}</div>
    <div class="stat-sub">${AREAS_CRONOGRAMA.length} área(s) cadastrada(s)</div>
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
    ? db.planos.filter(p => p.areaId === usuarioLogado.areaId)
    : db.planos;
  const auditoriasVisiveis = perfil === "gestor"
    ? db.auditorias.filter(a => a.areaId === usuarioLogado.areaId)
    : db.auditorias;

  // ── STATS ──
  const areasAuditaveis = AREAS_CRONOGRAMA.filter(a => !a.naoAuditada && !a.noa);
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
  function buildChecklist(areaId, atividadeId) {
    const area = AREAS_CRONOGRAMA.find(a => a.id === areaId);
    const grupo = CRONOGRAMA_ITENS.find(g => g.cat === area?.nome);
    const secs = [
      { title: `Cronograma — ${area?.nome || ""}`, items: (grupo?.itens || []).filter(i => !atividadeId || i.id === atividadeId).map(i => ({ texto: i.texto, peso: 1, cronItemId: i.id, objetivo: i.objetivo, controle: i.controle, periodicidade: i.periodicidade, metodologia: i.metodologia })) }
    ];
    return secs.flatMap(sec =>
      sec.items.map(item => ({ id: uid(), sec: sec.title, q: item.texto, peso: item.peso || 1, cronItemId: item.cronItemId, objetivo: item.objetivo, controle: item.controle, periodicidade: item.periodicidade, metodologia: item.metodologia, resp: null, clas: null, obs: "", evidencia: "" }))
    );
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
    const f = { ...form, nome: U(form.nome), categoria: U(form.categoria), diretor: form.diretor ? { ...form.diretor, nome: U(form.diretor.nome) } : form.diretor, subareas: (form.subareas||[]).map(s => ({ ...s, nome: U(s.nome), responsaveis: (s.responsaveis||[]).map(r => ({ ...r, nome: U(r.nome) })) })) };
    if (f.id) {
      upd("areas", arr => arr.map(a => a.id === f.id ? { ...a, ...f } : a));
      closeModal("area"); showToast("Área atualizada!");
    } else {
      upd("areas", a => [...a, { id: uid(), ...f }]);
      closeModal("area"); showToast("Área cadastrada!");
    }
  }

  // ── SAVE PROCESSO ──
  function saveProcesso(form) {
    if (!form.nome?.trim() || !form.areaId) { showToast("Informe nome e área.", "err"); return; }
    const area = AREAS_CRONOGRAMA.find(a => a.id === form.areaId);
    const f = { ...form, areaNome: area?.nome || "—", nome: U(form.nome), resp: U(form.resp) };
    if (f.id) {
      upd("processos", arr => arr.map(p => p.id === f.id ? { ...p, ...f } : p));
      closeModal("processo"); showToast("Processo atualizado!");
    } else {
      upd("processos", arr => [...arr, { id: uid(), ...f }]);
      closeModal("processo"); showToast("Processo cadastrado!");
    }
  }

  // ── SAVE CICLO ──
  function saveCiclo(form) {
    if (!form.nome?.trim()) { showToast("Informe o nome do ciclo.", "err"); return; }
    const f = { ...form, nome: U(form.nome), obs: U(form.obs) };
    if (f.id) {
      upd("ciclos", arr => arr.map(c => c.id === f.id ? { ...c, ...f } : c));
      closeModal("ciclo"); showToast("Ciclo atualizado!");
    } else {
      upd("ciclos", c => [...c, { id: uid(), status: "ativo", ...f }]);
      // Notifica todos os Auditores
      const periodo = form.ini && form.fim ? ` — Período: ${fmtDate(form.ini)} a ${fmtDate(form.fim)}` : "";
      const areas = AREAS_CRONOGRAMA.filter(a => !a.naoAuditada && !a.noa);
      const msg = `Novo ciclo "${form.nome}" criado${periodo}. ${areas.length} área${areas.length !== 1 ? "s" : ""} para auditar: ${areas.map(a => a.nome).join(", ")}.`;
      db.usuarios.filter(u => u.perfil === "auditor").forEach(u => {
        enviarNotificacao(u.id, `Novo Ciclo de Auditoria: ${form.nome}`, msg, "ciclo", { cicloNome: form.nome, ini: form.ini, fim: form.fim });
      });
      closeModal("ciclo"); showToast("Ciclo criado — Auditores notificados!");
    }
  }

  // ── SAVE USUARIO ──
  function saveUsuario(form) {
    if (!form.nome?.trim() || !form.email?.trim()) { showToast("Informe nome e e-mail.", "err"); return; }
    if (db.usuarios.some(u => u.email?.trim().toLowerCase() === form.email.trim().toLowerCase())) { showToast("Já existe um usuário com este e-mail.", "err"); return; }
    const area = AREAS_CRONOGRAMA.find(a => a.id === form.areaId);
    upd("usuarios", u => [...u, {
      id: uid(), ini: U(form.ini || form.nome.slice(0, 2)),
      areaNome: area?.nome || "—", ...form, nome: U(form.nome)
    }]);
    closeModal("usuario"); showToast("Usuário cadastrado!");
  }

  // ── SAVE MEMBRO ──
  // ── SAVE PLANO ──
  function savePlano(form, auto = false) {
    if (!form.desc?.trim()) { if (!auto) showToast("Informe a descrição.", "err"); return; }
    if (!auto && !form.respId) { showToast("Selecione um responsável.", "err"); return; }
    if (!auto && !form.causaRaiz) { showToast("Selecione a causa raiz.", "err"); return; }
    const evt = { data: new Date().toISOString(), acao: "Relatório criado", autor: auto ? "Sistema (Auditoria)" : usuarioLogado?.nome || "Sistema" };
    upd("planos", p => [...p, { id: uid(), status: "aberto", aprovacao: "pendente", historico: [evt], origem: auto ? "auditoria" : "manual", ...form, desc: U(form.desc) }]);
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

  function salvarConsolidacao(form) {
    const relatorio = { conclusoes: U(form.conclusoes), recomendacoes: U(form.recomendacoes), observacoes: U(form.observacoes), auditorId: usuarioLogado.id, auditorNome: usuarioLogado.nome, data: new Date().toISOString(), status: "enviado", consolidado: true };
    // Salva relatorioFinal em TODAS as auditorias do par
    if (form.auditoriaIds?.length) {
      upd("auditorias", arr => arr.map(a => form.auditoriaIds.includes(a.id) ? { ...a, relatorioFinal: relatorio } : a));
    }
    const exist = db.consolidacoes.find(c => c.areaId === form.areaId && c.cicloNome === form.cicloNome);
    if (exist) {
      upd("consolidacoes", arr => arr.map(c => c.id === exist.id ? { ...c, ...form, atualizadoEm: new Date().toISOString() } : c));
      showToast("Consolidação e relatório final atualizados!");
    } else {
      upd("consolidacoes", arr => [...arr, { id: uid(), ...form, auditorLiderId: usuarioLogado.id, auditorLiderNome: usuarioLogado.nome, criadoEm: new Date().toISOString() }]);
      showToast("Consolidação registrada — relatório final gerado!");
    }
  }

  // Exclui a auditoria e desfaz o que ela marcou: resultado no cronograma e planos gerados
  function excluirAuditoria(a) {
    const planos = db.planos.filter(p => p.auditoriaId === a.id).length;
    if (!window.confirm(`Excluir a auditoria de ${a.areaNome} (${fmtDate(a.data)})?${planos ? ` Os ${planos} plano(s) de ação gerados por ela também serão excluídos.` : ""} A marcação no cronograma será desfeita.`)) return;
    setDb(d => {
      const cronograma = Object.fromEntries(Object.entries(d.cronograma || {}).map(([mes, itens]) => [mes, Object.fromEntries(Object.entries(itens).map(([id, r]) => {
        if (r.auditoriaId !== a.id) return [id, r];
        const { auditoriaId, resultado, ...resto } = r;
        if (resto.realizada === a.data) delete resto.realizada;
        return [id, resto];
      }))]));
      return { ...d, cronograma, auditorias: d.auditorias.filter(x => x.id !== a.id), planos: d.planos.filter(p => p.auditoriaId !== a.id) };
    });
    showToast("Auditoria excluída.");
  }

  function salvarLancamentos(semanaId, valores) {
    upd("lancamentos", arr => [...(arr || []).filter(x => x.id !== semanaId), { id: semanaId, valores, atualizadoPor: usuarioLogado.nome, atualizadoEm: new Date().toISOString() }]);
  }

  function salvarRelatorioSemanal(r) {
    const rel = { ...r, conclusoes: U(r.conclusoes), recomendacoes: U(r.recomendacoes), observacoes: U(r.observacoes), autorId: usuarioLogado.id, autorNome: usuarioLogado.nome, data: new Date().toISOString() };
    upd("relatoriosSemanais", arr => [...arr.filter(x => x.id !== r.id), rel]);
    showToast("Relatório semanal salvo!");
  }

  function salvarRelatorioFinal(audId, form) {
    upd("auditorias", arr => arr.map(a => a.id === audId ? { ...a, relatorioFinal: { ...form, conclusoes: U(form.conclusoes), recomendacoes: U(form.recomendacoes), observacoes: U(form.observacoes), auditorId: usuarioLogado.id, auditorNome: usuarioLogado.nome, data: new Date().toISOString(), status: "enviado" } } : a));
    setRelatorioFinalAudId(null);
    showToast("Relatório final enviado ao administrador!");
  }

  function aprovarExtensao(id) {
    const evt = { data: new Date().toISOString(), acao: "Extensão de prazo aprovada", autor: usuarioLogado?.nome || "Sistema" };
    upd("planos", arr => arr.map(p => p.id === id && p.extensao ? { ...p, prazo: p.extensao.novoPrazo, extensao: { ...p.extensao, status: "aprovada", aprovadoPor: usuarioLogado?.nome || "—", aprovadoEm: new Date().toISOString() }, historico: [...(p.historico || []), evt] } : p));
    showToast("Extensão aprovada!");
  }
  function adicionarEvidenciaExecucao(planoId, texto) {
    if (!texto?.trim()) return;
    const ev = { id: uid(), texto: texto.startsWith("http") ? texto : U(texto), data: new Date().toISOString(), autor: usuarioLogado?.nome || "—" };
    upd("planos", arr => arr.map(p => p.id === planoId ? { ...p, evidenciasExecucao: [...(p.evidenciasExecucao || []), ev] } : p));
  }

  function rejeitarExtensao(id) {
    const evt = { data: new Date().toISOString(), acao: "Extensão de prazo rejeitada", autor: usuarioLogado?.nome || "Sistema" };
    upd("planos", arr => arr.map(p => p.id === id ? { ...p, extensao: { ...p.extensao, status: "rejeitada" }, historico: [...(p.historico || []), evt] } : p));
    showToast("Extensão rejeitada.", "err");
  }

  // ── FINALIZAR AUDITORIA ──
  function finalizarAuditoria() {
    const area = AREAS_CRONOGRAMA.find(a => a.id === audForm.areaId);
    const auditor = db.usuarios.find(u => u.id === audForm.auditorId);
    const ciclo = db.ciclos.find(c => c.id === audForm.cicloId);
    const score = calcScore(checklist);
    const ncs = checklist.filter(i => i.resp === "nok");

    const audId = uid();
    const auditoria = {
      id: audId, areaNome: area?.nome || "—", areaId: audForm.areaId,
      mes: audForm.cronMes && audForm.cronMes !== "bonus" ? audForm.cronMes : (audForm.data || new Date().toISOString()).slice(0, 7),
      bonus: audForm.cronMes === "bonus",
      atividadeId: audForm.atividadeId || "", atividadeTexto: CRONOGRAMA_ITENS.flatMap(g => g.itens).find(i => i.id === audForm.atividadeId)?.texto || "",
      auditorNome: auditor?.nome || "—", data: audForm.data,
      local: audForm.local, cicloNome: ciclo?.nome || "—",
      score, obs: U(audForm.obs), status: "concluida",
      processosAuditados: audForm.processosAuditados || [],
      ncs: ncs.map(i => ({ q: i.q, clas: i.clas || "obs", evidencia: i.evidencia || "", obs: i.obs || "", chamado: i.chamado || "" })),
      itensVerificados: checklist.map(i => ({ q: i.q, resp: i.resp || "", obs: i.obs || "", evidencia: i.evidencia || "", chamado: i.chamado || "" })),
      ciencia: null
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
        auditoriaId: audId,
      }, true);
    });

    upd("auditorias", a => [...a, auditoria]);

    // Atividades respondidas ganham data realizada e vínculo com a auditoria
    const mesAud = audForm.cronMes || (audForm.data || new Date().toISOString()).slice(0, 7);
    const respondidas = checklist.filter(i => i.cronItemId && i.resp);
    if (respondidas.length) setDb(d => {
      const cron = d.cronograma || {};
      const doMes = { ...(cron[mesAud] || {}) };
      respondidas.forEach(i => {
        const r = doMes[i.cronItemId] || {};
        doMes[i.cronItemId] = { ...r, realizada: audForm.data || r.realizada, responsavelId: r.responsavelId || audForm.auditorId || "", auditoriaId: audId, resultado: i.resp };
      });
      return { ...d, cronograma: { ...cron, [mesAud]: doMes } };
    });

    closeModal("auditoria"); setAudStep(1); setAudForm({}); setChecklist([]);
    showToast(respondidas.length ? `Auditoria registrada — ${respondidas.length} atividade(s) marcada(s) no cronograma!` : "Auditoria registrada com sucesso!");
  }

  // ── CHART DATA ──
  const chartConf = areasAuditaveis.map(a => {
    const score = scoreAreaCiclo(a.id, auditoriasVisiveis) || 0;
    return { name: a.nome.length > 14 ? a.nome.slice(0, 14) + "…" : a.nome, score, fill: score ? scoreColor(score) : F.gray6 };
  }).filter(a => a.score > 0);


  const chartPlanos = [
    { name: "Concluídos", value: planosAprovados.filter(p => p.status === "concluido").length, fill: F.green },
    { name: "Em Andamento", value: planosAprovados.filter(p => p.status === "andamento").length, fill: F.amber },
    { name: "Abertos", value: planosAprovados.filter(p => p.status === "aberto").length, fill: F.blue },
    { name: "Atrasados", value: planosAtrasados.length, fill: F.red },
  ].filter(d => d.value > 0);

  // ── SIDEBAR ──
  const navItems = [
    { id: "dashboard", icon: "▦", label: "Dashboard", section: "Visão Geral" },
    { id: "cronograma", icon: "▤", label: "Cronograma de Auditoria", section: "Operação" },
    { id: "bonus", icon: "★", label: "Auditorias Bônus", section: "Operação" },
    { id: "areas", icon: "◉", label: "Áreas", section: "Operação" },
    { id: "processos", icon: "⬡", label: "Processos", section: "Operação" },
    { id: "auditorias", icon: "◎", label: "Auditorias", section: "Operação", badge: auditoriasVisiveis.filter(a => a.status === "aberta").length },
    { id: "consolidar", icon: "⊕", label: "Consolidar Auditorias", section: "Operação", badge: (() => { const pares = {}; db.auditorias.forEach(a => { if (a.cicloNome && a.cicloNome !== "—") { const k = `${a.areaId}-${a.cicloNome}`; pares[k] = (pares[k] || 0) + 1; } }); return Object.values(pares).filter(v => v >= 2).length; })() || 0 },
    { id: "relatorio-conclusao", icon: "📋", label: "Relatório de Conclusão", section: "Operação", badge: perfil === "administrador" ? semanasDoMes(ymdLocal(new Date()).slice(0, 7)).filter(sem => sem.quinta <= ymdLocal(new Date()) && !(db.relatoriosSemanais || []).some(r => r.id === sem.id)).length || 0 : 0 },
    { id: "planos", icon: "◷", label: "Planos de Ação", section: "Operação", badge: planosPendAprov.length || planosAtrasados.length },
    { id: "ncs", icon: "⚑", label: "Não Conformidades", section: "Operação" },
    { id: "despesas", icon: "◧", label: "Despesas Fixas", section: "Controles" },
    { id: "ciclos", icon: "◈", label: "Ciclos", section: "Gestão" },
    { id: "usuarios", icon: "○", label: "Usuários", section: "Gestão" },
  ].filter(item => podeAcessar(perfil, item.id));

  return (
    <>
      <style>{css}</style>
      <div style={{ display: "flex", minHeight: "100vh" }}>

        {/* OVERLAY MOBILE */}
        {isMobile && sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 199, animation: "fadeIn 0.2s ease" }} />
        )}

        {/* SIDEBAR */}
        <aside style={{
          width: 220, minHeight: "100vh", background: F.charcoal,
          display: "flex", flexDirection: "column", position: "fixed",
          top: 0, left: 0, zIndex: 200,
          transform: isMobile && !sidebarOpen ? "translateX(-100%)" : "translateX(0)",
          transition: "transform 0.28s cubic-bezier(.4,0,.2,1)"
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
            {navItems.map((item, i) => (
              <>
                {item.section !== navItems[i - 1]?.section && (
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
              <button
                onClick={() => setUsuarioLogado(null)}
                title="Sair"
                style={{ background: "none", border: "none", color: F.gray4, cursor: "pointer", fontSize: 16, padding: "2px 4px", flexShrink: 0, transition: "color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.color = F.red}
                onMouseLeave={e => e.currentTarget.style.color = F.gray4}
              >⏏</button>
            </div>
            {(() => {
              const st = {
                carregando: [F.gray4, "Conectando ao banco..."],
                online: [F.green, "Dados salvos no banco"],
                offline: [F.amber, "Sem conexão — salvando neste navegador"],
                local: [F.amber, "Banco não configurado — só neste navegador"],
              }[nuvem];
              return <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: F.gray4, padding: "8px 10px 0" }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: st[0], flexShrink: 0 }} />{st[1]}</div>;
            })()}
          </div>
        </aside>

        {/* MAIN */}
        <main style={{ marginLeft: isMobile ? 0 : 220, flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

          {/* TOPBAR */}
          <div style={{
            padding: isMobile ? "12px 16px" : "14px 28px", borderBottom: `1px solid ${F.gray6}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "#fff", position: "sticky", top: 0, zIndex: 50,
            boxShadow: "0 1px 0 rgba(0,0,0,0.05)", gap: 8
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {isMobile && (
                <button onClick={() => setSidebarOpen(o => !o)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: F.charcoal, padding: "2px 4px", flexShrink: 0, lineHeight: 1 }}>☰</button>
              )}
              <div style={{
                fontFamily: "'Barlow Condensed',sans-serif",
                fontSize: isMobile ? 16 : 20, fontWeight: 800, textTransform: "uppercase",
                letterSpacing: 0.5, color: F.charcoal, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: isMobile ? 160 : "none"
              }}>
                {navItems.find(n => n.id === view)?.label || "Dashboard"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 5 : 8, flexShrink: 0 }}>
              {!isMobile && <a href={`/manual.html?perfil=${perfil}`} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600, color: F.gray3, background: F.offWhite, border: `1.5px solid ${F.gray6}`, textDecoration: "none", fontFamily: "'Barlow',sans-serif", transition: "all 0.15s" }} onMouseEnter={e => { e.currentTarget.style.borderColor = F.red; e.currentTarget.style.color = F.red; }} onMouseLeave={e => { e.currentTarget.style.borderColor = F.gray6; e.currentTarget.style.color = F.gray3; }}>? Suporte</a>}
              {isMobile && <a href={`/manual.html?perfil=${perfil}`} target="_blank" rel="noreferrer" style={{ background: "none", border: "none", fontSize: 18, textDecoration: "none", color: F.gray3 }}>?</a>}
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
                              background: n.tipo === "ciclo" ? F.blueDim : n.tipo === "aprovacao" ? F.amberDim : n.titulo === "Vence hoje!" ? F.redDim : F.amberDim,
                            }}>
                              {n.tipo === "ciclo" ? "📅" : n.tipo === "aprovacao" ? "⏳" : "⏰"}
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
          <div style={{ padding: isMobile ? "16px 12px" : "24px 28px", flex: 1, minWidth: 0 }}>

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

            {/* ── INDICADORES (topo do dashboard) ── */}
            {view === "dashboard" && perfil !== "gestor" && (
              <div>
                {/* Stats */}
                <div className="resp-grid-5" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 20 }}>
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
              </div>
            )}

            {/* ── KANBAN DE FLUXO ── */}
            {view === "dashboard" && (() => {
              const ETAPAS = [
                { id: "novo-ciclo",   label: "Iniciar Auditoria", icon: "📅", cor: F.red,   perfisResponsaveis: ["auditor"],
                  itens: db.ciclos.filter(c => c.status === "ativo" && c.ini && c.ini <= new Date().toISOString().split("T")[0]).filter(c => !db.auditorias.find(a => a.cicloNome === c.nome)).map(c => ({ titulo: c.nome, sub: `Início: ${fmtDate(c.ini)} · Nenhuma auditoria iniciada`, id: c.id })),
                  acaoPerfis: ["auditor"], acao: "Ciclo ativo — iniciar auditorias das áreas" },
                { id: "auditoria",    label: "Auditoria",         icon: "◎", cor: F.red,    perfisResponsaveis: ["auditor","administrador"],
                  itens: db.auditorias.filter(a => !a.relatorioFinal?.status).map(a => ({ titulo: a.areaNome, sub: `Score: ${a.score}% · ${fmtDate(a.data)}`, id: a.id })),
                  acaoPerfis: ["auditor","administrador"], acao: "Elaborar relatório final" },
                { id: "aprovacao",    label: "Aprovação",         icon: "✓", cor: F.green,  perfisResponsaveis: ["administrador"],
                  itens: db.planos.filter(p => p.aprovacao === "pendente").map(p => ({ titulo: p.desc?.slice(0,40) + (p.desc?.length > 40 ? "…" : ""), sub: p.areaNome, id: p.id })),
                  acaoPerfis: ["administrador"], acao: "Aprovar ou rejeitar plano" },
                { id: "execucao",     label: "Execução",          icon: "◷", cor: F.blue,   perfisResponsaveis: ["gestor"],
                  itens: planosAprovados.filter(p => p.status !== "concluido").map(p => ({ titulo: p.desc?.slice(0,40) + (p.desc?.length > 40 ? "…" : ""), sub: `${p.areaNome} · ${fmtDate(p.prazo)}`, id: p.id })),
                  acaoPerfis: ["gestor"], acao: "Executar e atualizar status" },
                { id: "ciencia",      label: "Ciência",           icon: "✔", cor: "#00875A", perfisResponsaveis: ["gestor"],
                  itens: auditoriasVisiveis.filter(a => !a.ciencia?.confirmado).map(a => ({ titulo: a.areaNome, sub: `Score: ${a.score}% · ${fmtDate(a.data)}`, id: a.id })),
                  acaoPerfis: ["gestor"], acao: "Registrar ciência da auditoria" },
              ];
              // filtra etapas relevantes para o perfil atual
              const etapasVisiveis = ETAPAS.filter(e => e.perfisResponsaveis.includes(perfil));
              const minhasAcoes = ETAPAS.filter(e => e.acaoPerfis.includes(perfil) && e.itens.length > 0);
              return (
                <div style={{ marginBottom: 24 }}>
                  {/* Minhas ações */}
                  {minhasAcoes.length > 0 && (
                    <div style={{ background: F.redDim, border: `1.5px solid ${F.redBorder}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: F.red, flexShrink: 0 }}>
                        ⚡ Suas ações pendentes
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {minhasAcoes.map(e => (
                          <div key={e.id} style={{ background: "#fff", borderRadius: 7, padding: "5px 12px", border: `1.5px solid ${e.cor}`, display: "flex", alignItems: "center", gap: 7 }}>
                            <span style={{ fontSize: 13 }}>{e.icon}</span>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 800, color: e.cor, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "'Barlow Condensed',sans-serif" }}>{e.label}</div>
                              <div style={{ fontSize: 10, color: F.gray3 }}>{e.itens.length} item{e.itens.length !== 1 ? "s" : ""} · {e.acao}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Kanban */}
                  <div style={{ overflowX: "auto", paddingBottom: 4 }}>
                    <div style={{ display: "flex", gap: 10, minWidth: "max-content" }}>
                      {etapasVisiveis.map((etapa, idx) => {
                        const eMinha = etapa.acaoPerfis.includes(perfil);
                        const temItens = etapa.itens.length > 0;
                        return (
                          <div key={etapa.id} style={{ width: 200, flexShrink: 0 }}>
                            {/* Cabeçalho da coluna */}
                            <div style={{ background: eMinha && temItens ? F.red : F.gray6, borderRadius: "8px 8px 0 0", padding: "8px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 14 }}>{etapa.icon}</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: eMinha && temItens ? "#fff" : F.gray3 }}>{etapa.label}</div>
                              </div>
                              <div style={{ background: eMinha && temItens ? "rgba(255,255,255,.3)" : F.gray5, borderRadius: 20, padding: "1px 7px", fontSize: 11, fontWeight: 700, color: eMinha && temItens ? "#fff" : F.gray3 }}>{etapa.itens.length}</div>
                            </div>
                            {/* Itens */}
                            <div style={{ background: "#fff", border: `1px solid ${eMinha && temItens ? etapa.cor : F.gray6}`, borderTop: "none", borderRadius: "0 0 8px 8px", minHeight: 80, padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                              {etapa.itens.length === 0 ? (
                                <div style={{ color: F.gray5, fontSize: 11, textAlign: "center", padding: "16px 0" }}>Nenhum item</div>
                              ) : etapa.itens.slice(0,4).map((item, i) => (
                                <div key={i} style={{ background: eMinha ? F.redDim : F.offWhite, borderRadius: 6, padding: "7px 9px", border: `1px solid ${eMinha ? F.redBorder : F.gray6}` }}>
                                  <div style={{ fontSize: 11.5, fontWeight: 600, color: F.charcoal, lineHeight: 1.3, marginBottom: 2 }}>{item.titulo}</div>
                                  <div style={{ fontSize: 10, color: F.gray4 }}>{item.sub}</div>
                                </div>
                              ))}
                              {etapa.itens.length > 4 && (
                                <div style={{ fontSize: 10, color: F.gray4, textAlign: "center", padding: "3px 0" }}>+{etapa.itens.length - 4} mais</div>
                              )}
                            </div>
                            {/* Quem age */}
                            <div style={{ marginTop: 4, fontSize: 9.5, color: eMinha ? etapa.cor : F.gray4, textAlign: "center", fontWeight: eMinha ? 700 : 400, fontFamily: "'Barlow Condensed',sans-serif", textTransform: "uppercase", letterSpacing: 0.5 }}>
                              {eMinha ? "▲ Sua ação" : etapa.acaoPerfis.map(p => PERFIL_LABEL[p] || p).join(" / ")}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── DASHBOARD GESTOR ── */}
            {view === "dashboard" && perfil === "gestor" && (() => {
              const minhasAuds = auditoriasVisiveis;
              const ultimaAud = [...minhasAuds].sort((a,b) => (b.data||"").localeCompare(a.data||""))[0];
              const planosArea = planosAprovados;
              const emAndamento = planosArea.filter(p => p.status === "andamento").length;
              const concluidos = planosArea.filter(p => p.status === "concluido").length;
              const abertos = planosArea.filter(p => p.status === "aberto").length;
              return (
                <div>
                  {/* Header da área */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                    <div>
                      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: F.gray4, marginBottom: 2 }}>Minha Área</div>
                      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 28, fontWeight: 900, color: F.charcoal }}>{usuarioLogado.areaNome}</div>
                    </div>
                    {confGeral !== null && (
                      <div style={{ textAlign: "center", background: "#fff", border: `2px solid ${scoreColor(confGeral)}`, borderRadius: 12, padding: "14px 20px" }}>
                        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 42, fontWeight: 900, color: scoreColor(confGeral), lineHeight: 1 }}>{confGeral}%</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: scoreColor(confGeral), textTransform: "uppercase", letterSpacing: 0.5 }}>{scoreLabel(confGeral)}</div>
                        <div style={{ fontSize: 10, color: F.gray4, marginTop: 2 }}>Conformidade Geral</div>
                      </div>
                    )}
                  </div>

                  {/* Cards de indicadores */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
                    <StatCard label="Auditorias Realizadas" value={minhasAuds.length || "—"}
                      sub={ultimaAud ? `Última: ${fmtDate(ultimaAud.data)}` : "Nenhuma realizada"} accent={F.red} delay={0} />
                    <StatCard label="Planos em Aberto" value={abertos || "—"}
                      sub={`${planosArea.length} plano${planosArea.length !== 1 ? "s" : ""} no total`} accent={F.amber} delay={0.05} />
                    <StatCard label="Em Andamento" value={emAndamento || "—"}
                      sub={`${concluidos} concluído${concluidos !== 1 ? "s" : ""}`} accent={F.blue} delay={0.08} />
                    <StatCard label="Ações em Atraso" value={planosAtrasados.length || "—"}
                      sub={planosAtrasados.length ? "Requer atenção" : "Nenhum atrasado"} accent={planosAtrasados.length > 0 ? F.red : F.green} delay={0.1} />
                  </div>

                  <div className="resp-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14, marginBottom: 14 }}>
                    {/* Status dos planos */}
                    <Card className="anim2">
                      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16 }}>Relatórios de Conclusão</div>
                      {planosArea.length > 0 ? (
                        <ResponsiveContainer width="100%" height={160}>
                          <PieChart>
                            <Pie data={[
                              { name: "Concluídos", value: concluidos, fill: F.green },
                              { name: "Em Andamento", value: emAndamento, fill: F.blue },
                              { name: "Abertos", value: abertos, fill: F.amber },
                              { name: "Atrasados", value: planosAtrasados.length, fill: F.red },
                            ].filter(d => d.value > 0)} cx="50%" cy="45%" outerRadius={65} dataKey="value" label={({ name, value }) => `${value}`} labelLine={false}>
                              {[F.green, F.blue, F.amber, F.red].map((fill, i) => <Cell key={i} fill={fill} />)}
                            </Pie>
                            <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                            <Tooltip contentStyle={{ background: F.charcoal, border: "none", borderRadius: 6, color: "#fff", fontSize: 12 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
                          <div style={{ fontSize: 28, opacity: 0.15 }}>✅</div>
                          <div style={{ fontSize: 12.5, color: F.gray4 }}>Nenhum relatório aprovado</div>
                        </div>
                      )}
                    </Card>
                  </div>

                  {/* Últimas auditorias */}
                  <Card className="anim3">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>Histórico de Auditorias da Área</div>
                      <button onClick={() => setView("auditorias")} style={{ fontSize: 11.5, color: F.red, background: "none", border: "none", cursor: "pointer", fontFamily: "'Barlow',sans-serif", fontWeight: 600 }}>Ver todas →</button>
                    </div>
                    {minhasAuds.length > 0 ? (
                      <DataTable
                        cols={["Data", "Auditor", "Ciclo", "Score", "NCs", "Ciência"]}
                        rows={[...minhasAuds].reverse().slice(0,6).map(a => {
                          const ncc = a.ncs?.filter(n => n.clas === "nc").length || 0;
                          return <>
                            <TD style={{ color: F.gray3 }}>{fmtDate(a.data)}</TD>
                            <TD style={{ color: F.gray3 }}>{a.auditorNome}</TD>
                            <TD>{a.cicloNome !== "—" ? <Tag>{a.cicloNome}</Tag> : "—"}</TD>
                            <TD><strong style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, color: scoreColor(a.score) }}>{a.score}%</strong></TD>
                            <TD>{ncc > 0 ? <Tag color={F.red} bg={F.redDim}>{ncc} NC</Tag> : "—"}</TD>
                            <TD>{a.ciencia?.confirmado ? <Pill color={F.green} bg={F.greenDim}>Registrada</Pill> : <button onClick={() => setCienciaAuditoriaId(a.id)} style={{ fontSize: 10.5, color: F.green, background: F.greenDim, border: `1px solid ${F.green}44`, borderRadius: 5, padding: "2px 8px", cursor: "pointer", fontWeight: 700, fontFamily: "'Barlow',sans-serif" }}>Registrar</button>}</TD>
                          </>;
                        })}
                        empty={{ icon: "◎", title: "Nenhuma auditoria realizada para esta área" }}
                      />
                    ) : (
                      <div style={{ textAlign: "center", padding: "30px 0", color: F.gray4 }}>
                        <div style={{ fontSize: 28, opacity: 0.15, marginBottom: 8 }}>◎</div>
                        <div style={{ fontSize: 13 }}>Nenhuma auditoria realizada para esta área</div>
                      </div>
                    )}
                  </Card>
                </div>
              );
            })()}

            {/* ── DASHBOARD ADMIN/AUDITOR ── */}
            {view === "dashboard" && perfil !== "gestor" && (
              <div>
                <QuantidadeLancamentos registros={db.lancamentos || []} podeEditar={perfil === "administrador" || perfil === "area-processos"} onSalvar={salvarLancamentos} />

                {/* Gráficos */}
                <div className="resp-grid-2" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 14 }}>
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

                {/* Últimas auditorias */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
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

                {/* Cronograma de Ciclos */}
                {db.ciclos.length > 0 && (
                  <Card className="anim4" style={{ marginTop: 14 }}>
                    {/* Cabeçalho com toggle */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: F.charcoal }}>
                        Cronograma de Auditorias
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        {[["lista","☰ Lista"],["calendario","📅 Calendário"]].map(([id, label]) => (
                          <button key={id} onClick={() => setCronogramaView(id)} style={{ padding: "5px 12px", borderRadius: 6, border: "none", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "'Barlow',sans-serif", background: cronogramaView === id ? F.red : F.offWhite, color: cronogramaView === id ? "#fff" : F.gray3, transition: "all 0.15s" }}>{label}</button>
                        ))}
                      </div>
                    </div>

                    {/* VISTA LISTA */}
                    {cronogramaView === "lista" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {[...db.ciclos].sort((a, b) => (a.ini || "").localeCompare(b.ini || "")).map(ciclo => {
                          const audsNoCiclo = db.auditorias.filter(a => a.cicloNome === ciclo.nome);
                          const areasAuditadasIds = new Set(audsNoCiclo.map(a => a.areaId));
                          const total = areasAuditaveis.length;
                          const feitas = areasAuditaveis.filter(a => areasAuditadasIds.has(a.id)).length;
                          const pct = total > 0 ? Math.round((feitas / total) * 100) : 0;
                          const hoje = new Date().toISOString().split("T")[0];
                          const emAndamento = ciclo.ini && ciclo.fim && ciclo.ini <= hoje && ciclo.fim >= hoje;
                          const futuro = ciclo.ini && ciclo.ini > hoje;
                          const statusCor = pct === 100 ? F.green : emAndamento ? F.blue : futuro ? F.amber : F.gray3;
                          const statusLabel = pct === 100 ? "Concluído" : emAndamento ? "Em Andamento" : futuro ? "Programado" : "Encerrado";
                          return (
                            <div key={ciclo.id} style={{ border: `1px solid ${F.gray6}`, borderRadius: 8, padding: "12px 14px", borderLeft: `4px solid ${statusCor}` }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                                <div style={{ flex: 1, minWidth: 120 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 800, color: F.charcoal }}>{ciclo.nome}</span>
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: `${statusCor}18`, color: statusCor, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "'Barlow Condensed',sans-serif" }}>{statusLabel}</span>
                                  </div>
                                  <div style={{ fontSize: 11, color: F.gray4, marginTop: 2 }}>{ciclo.ini ? fmtDate(ciclo.ini) : "—"} {ciclo.fim ? `→ ${fmtDate(ciclo.fim)}` : ""}</div>
                                </div>
                                <div style={{ textAlign: "right", flexShrink: 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: statusCor }}>{feitas}/{total} áreas</div>
                                  <div style={{ fontSize: 10, color: F.gray4 }}>{pct}% concluído</div>
                                </div>
                              </div>
                              <div style={{ marginTop: 10, height: 6, background: F.gray6, borderRadius: 4, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${pct}%`, background: statusCor, borderRadius: 4, transition: "width 0.4s ease" }} />
                              </div>
                              {total > 0 && (
                                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10 }}>
                                  {areasAuditaveis.map(a => {
                                    const auditada = areasAuditadasIds.has(a.id);
                                    return (
                                      <span key={a.id} style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 5, fontFamily: "'Barlow Condensed',sans-serif", background: auditada ? F.greenDim : F.offWhite, color: auditada ? F.green : F.gray4, border: `1px solid ${auditada ? F.green + "44" : F.gray6}` }}>
                                        {auditada ? "✓ " : "○ "}{a.nome}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* VISTA CALENDÁRIO */}
                    {cronogramaView === "calendario" && (() => {
                      const { ano, mes } = calMes;
                      const primeiroDia = new Date(ano, mes, 1).getDay();
                      const diasNoMes = new Date(ano, mes + 1, 0).getDate();
                      const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
                      const hoje = new Date().toISOString().split("T")[0];
                      const diaStr = d => `${ano}-${String(mes+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

                      // Atividades do cronograma (mensal e bônus) programadas para cada dia pela data prevista
                      const itemPorId = {};
                      CRONOGRAMA_ITENS.forEach(g => g.itens.forEach(i => { itemPorId[i.id] = { ...i, area: g.cat }; }));
                      const doDia = {};
                      Object.entries(db.cronograma || {}).forEach(([folha, itens]) => Object.entries(itens || {}).forEach(([id, r]) => {
                        if (!r?.prevista || !r.prevista.startsWith(diaStr(1).slice(0, 7)) || !itemPorId[id]) return;
                        if (perfil === "auditor" && !CAMPOS_RESPONSAVEL.some(c => r[c] === usuarioLogado.id)) return;
                        (doDia[r.prevista] = doDia[r.prevista] || []).push({ id, folha, r, item: itemPorId[id], st: statusCronograma(r, hoje) });
                      }));
                      const selecionado = diaCalendario && diaCalendario.startsWith(diaStr(1).slice(0, 7)) ? diaCalendario : null;

                      return (
                        <div>
                          {/* Navegação do mês */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                            <button onClick={() => setCalMes(m => { const d = new Date(m.ano, m.mes - 1); return { ano: d.getFullYear(), mes: d.getMonth() }; })} style={{ background: F.offWhite, border: `1px solid ${F.gray6}`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 14, color: F.gray3 }}>‹</button>
                            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 800, color: F.charcoal, textTransform: "uppercase", letterSpacing: 0.5 }}>{MESES[mes]} {ano}</div>
                            <button onClick={() => setCalMes(m => { const d = new Date(m.ano, m.mes + 1); return { ano: d.getFullYear(), mes: d.getMonth() }; })} style={{ background: F.offWhite, border: `1px solid ${F.gray6}`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 14, color: F.gray3 }}>›</button>
                          </div>

                          {/* Grid do calendário */}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 3 }}>
                            {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(d => (
                              <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: F.gray4, padding: "4px 0", fontFamily: "'Barlow Condensed',sans-serif", textTransform: "uppercase", letterSpacing: 0.5 }}>{d}</div>
                            ))}
                            {Array.from({ length: primeiroDia }).map((_, i) => <div key={`v${i}`} />)}
                            {Array.from({ length: diasNoMes }, (_, i) => i + 1).map(dia => {
                              const ds = diaStr(dia);
                              const ativs = doDia[ds] || [];
                              const isHoje = ds === hoje, isSel = ds === selecionado;
                              return (
                                <div key={dia} onClick={() => setDiaCalendario(isSel ? null : ds)} style={{ borderRadius: 6, border: `1.5px solid ${isSel ? F.charcoal : isHoje ? F.red : F.gray6}`, background: isHoje ? F.redDim : "#fff", minHeight: 78, padding: "4px 5px", cursor: ativs.length ? "pointer" : "default", minWidth: 0 }}>
                                  <div style={{ fontSize: 11, fontWeight: isHoje ? 700 : 400, color: isHoje ? F.red : F.gray3, marginBottom: 3, textAlign: "right" }}>{dia}</div>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                    {ativs.slice(0, 3).map(a => (
                                      <div key={a.folha + a.id} title={`${a.item.area} — ${a.item.texto} (${a.st.label})`} style={{ fontSize: 9.5, lineHeight: 1.25, padding: "2px 4px", borderRadius: 3, background: a.st.bg, color: a.st.cor, borderLeft: `3px solid ${a.st.cor}`, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 600 }}>
                                        {a.item.area}: {a.item.texto}
                                      </div>
                                    ))}
                                    {ativs.length > 3 && <div style={{ fontSize: 9.5, color: F.gray3, fontWeight: 700 }}>+{ativs.length - 3} atividade{ativs.length - 3 !== 1 ? "s" : ""}</div>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Atividades do dia selecionado */}
                          {selecionado && (
                            <div style={{ marginTop: 12, border: `1px solid ${F.gray6}`, borderRadius: 8, padding: "10px 12px" }}>
                              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 800, textTransform: "uppercase", color: F.charcoal, marginBottom: 8 }}>
                                {new Date(selecionado + "T00:00").toLocaleDateString("pt-BR", { weekday: "long" })}, {fmtDate(selecionado)} · {(doDia[selecionado] || []).length} atividade{(doDia[selecionado] || []).length !== 1 ? "s" : ""}
                              </div>
                              {(doDia[selecionado] || []).length === 0 ? <div style={{ fontSize: 12.5, color: F.gray4 }}>Nenhuma atividade programada para este dia.</div> : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  {doDia[selecionado].map(a => (
                                    <div key={a.folha + a.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", borderLeft: `4px solid ${a.st.cor}`, background: F.offWhite, borderRadius: 6, padding: "7px 10px" }}>
                                      <div style={{ flex: 1, fontSize: 12.5, color: F.charcoal, lineHeight: 1.45 }}>
                                        <strong>{a.item.area}</strong>{a.folha === "bonus" && <span style={{ color: F.amber, fontWeight: 700 }}> · Bônus</span>} — {a.item.texto}
                                        <div style={{ fontSize: 11.5, color: F.gray3, marginTop: 2 }}>
                                          {CAMPOS_RESPONSAVEL.map(c => db.usuarios.find(u => u.id === a.r[c])?.nome).filter(Boolean).join(", ") || "Sem responsável"}
                                          {a.r.previstaConclusao ? ` · conclusão prevista ${fmtDate(a.r.previstaConclusao)}` : ""}
                                        </div>
                                      </div>
                                      <Tag color={a.st.cor} bg={a.st.bg}>{a.st.label}</Tag>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <button onClick={() => setView("ciclos")} style={{ fontSize: 11.5, color: F.red, background: "none", border: "none", cursor: "pointer", fontFamily: "'Barlow',sans-serif", fontWeight: 600, marginTop: 14 }}>Ver todos os ciclos →</button>
                  </Card>
                )}
              </div>
            )}

            {/* ── ÁREAS ── */}
            {view === "areas" && (
              <Card>
                <DataTable
                  cols={["Área", "Categoria", "Diretor", "Subáreas", "Status", ...(podeExecutar(perfil, "criar") || podeExecutar(perfil, "excluir") ? [""] : [])]}
                  rows={AREAS_CRONOGRAMA.map(a => (
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
                  cols={["Processo", "Área", "Responsável", "Documento", "Status", ...(podeExecutar(perfil, "criar") || podeExecutar(perfil, "excluir") ? [""] : [])]}
                  rows={db.processos.map(p => {
                    const sm = { conforme: [F.green, F.greenDim, "Conforme"], revisao: [F.amber, F.amberDim, "Em Revisão"], pendente: [F.red, F.redDim, "Pendente"], inativo: [F.gray3, F.gray6, "Inativo"] };
                    const [c, bg, lbl] = sm[p.status] || [F.gray3, F.gray6, p.status];
                    return <>
                      <TD><strong>{p.nome}</strong></TD>
                      <TD style={{ color: F.gray3 }}>{p.areaNome}</TD>
                      <TD style={{ color: F.gray3 }}>{p.resp || "—"}</TD>
                      <TD>{p.link ? <a href={p.link} target="_blank" rel="noreferrer" style={{ color: F.red, fontSize: 12, fontWeight: 600 }}>↗ SharePoint</a> : "—"}</TD>
                      <TD><Pill color={c} bg={bg}>{lbl}</Pill></TD>
                      {(podeExecutar(perfil, "criar") || podeExecutar(perfil, "excluir")) && (
                        <TD>
                          <div style={{ display: "flex", gap: 4 }}>
                            {podeExecutar(perfil, "criar") && <button onClick={() => openModal("processo", p)} style={{ background: F.offWhite, border: `1px solid ${F.gray6}`, borderRadius: 5, color: F.gray3, cursor: "pointer", fontSize: 13, padding: "3px 8px" }}>✎</button>}
                            {podeExecutar(perfil, "excluir") && <button onClick={() => upd("processos", arr => arr.filter(x => x.id !== p.id))} style={{ background: "none", border: "none", color: F.gray4, cursor: "pointer", fontSize: 16, padding: "2px 6px" }}>✕</button>}
                          </div>
                        </TD>
                      )}
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

            {/* ── RELATÓRIO DE CONCLUSÃO ── */}
            {view === "relatorio-conclusao" && (() => {
              // Todos os perfis veem todos os relatórios
              const relFiltrados = db.auditorias.filter(a => a.relatorioFinal?.status === "enviado");
              const cmap = { nc: [F.red, F.redDim, "NC"], mel: [F.blue, F.blueDim, "Melhoria"], obs: [F.gray3, F.gray6, "Obs"] };
              return (
                <div>
                  <AuditoriasDoMes auditorias={db.auditorias} semanais={db.relatoriosSemanais || []} podeElaborar={perfil === "administrador"} onSalvarSemanal={salvarRelatorioSemanal} />
                  <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: F.charcoal, marginBottom: 10 }}>Relatórios finais</div>
                  <div style={{ fontSize: 12.5, color: F.gray3, background: F.blueDim, border: `1px solid ${F.blue}33`, borderRadius: 8, padding: "10px 14px", marginBottom: 20, lineHeight: 1.7 }}>
                    Relatórios de conclusão elaborados pelo <strong>Auditor</strong> após a consolidação das auditorias realizadas.
                  </div>
                  {relFiltrados.length === 0 ? (
                    <Card>
                      <div style={{ textAlign: "center", padding: "48px 0" }}>
                        <div style={{ fontSize: 36, opacity: 0.15, marginBottom: 10 }}>📋</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: F.gray3, marginBottom: 6 }}>Nenhum relatório disponível</div>
                        <div style={{ fontSize: 13, color: F.gray4 }}>Os relatórios aparecerão aqui quando o Auditor concluir a consolidação.</div>
                      </div>
                    </Card>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {[...relFiltrados].sort((a,b) => (b.relatorioFinal.data||"").localeCompare(a.relatorioFinal.data||"")).map(a => {
                        const r = a.relatorioFinal;
                        const ncc = a.ncs?.filter(n => n.clas === "nc").length || 0;
                        const mel = a.ncs?.filter(n => n.clas === "mel").length || 0;
                        const obs = a.ncs?.filter(n => n.clas === "obs").length || 0;
                        const consol = db.consolidacoes.find(c => c.areaId === a.areaId && c.cicloNome === a.cicloNome);
                        return (
                          <Card key={a.id} style={{ border: `1.5px solid ${F.gray6}` }}>
                            {/* Cabeçalho */}
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                                  <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 900, color: F.charcoal }}>{a.areaNome}</div>
                                  {a.cicloNome && a.cicloNome !== "—" && <Tag>{a.cicloNome}</Tag>}
                                  {r.consolidado && <Pill color={F.blue} bg={F.blueDim}>Consolidado</Pill>}
                                </div>
                                <div style={{ fontSize: 12, color: F.gray4 }}>
                                  Auditado em {fmtDate(a.data)} · {a.auditorNome}
                                  {a.local && ` · ${a.local}`}
                                </div>
                                <div style={{ fontSize: 11.5, color: F.gray3, marginTop: 3 }}>
                                  Relatório elaborado por <strong style={{ color: F.charcoal }}>{r.auditorNome}</strong> em {fmtDate(r.data?.split("T")[0])}
                                </div>
                              </div>
                              <div style={{ textAlign: "center", flexShrink: 0 }}>
                                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 42, fontWeight: 900, color: scoreColor(a.score), lineHeight: 1 }}>{a.score}%</div>
                                <div style={{ fontSize: 11, color: scoreColor(a.score), fontWeight: 700, textTransform: "uppercase" }}>{scoreLabel(a.score)}</div>
                              </div>
                            </div>

                            {/* Indicadores */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
                              {[[ncc,"Não Conformidades",F.red,F.redDim],[mel,"Melhorias",F.blue,F.blueDim],[obs,"Observações",F.gray3,F.gray6]].map(([v,l,c,bg]) => (
                                <div key={l} style={{ background: bg, borderRadius: 7, padding: "8px 10px", textAlign: "center" }}>
                                  <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 900, color: c, lineHeight: 1 }}>{v}</div>
                                  <div style={{ fontSize: 9.5, fontWeight: 700, color: c, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>{l}</div>
                                </div>
                              ))}
                            </div>

                            {/* Conteúdo do relatório */}
                            {[["Conclusões", r.conclusoes],["Recomendações", r.recomendacoes],["Observações Adicionais", r.observacoes]].filter(([,v]) => v).map(([label, valor]) => (
                              <div key={label} style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: F.gray4, fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 5 }}>{label}</div>
                                <div style={{ fontSize: 13, color: F.charcoal, lineHeight: 1.8, background: F.offWhite, borderRadius: 7, padding: "10px 14px" }}>{valor}</div>
                              </div>
                            ))}

                            {/* NCs detalhadas */}
                            {a.ncs?.length > 0 && (
                              <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: F.gray4, fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 8 }}>
                                  Não Conformidades ({a.ncs.length})
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                  {a.ncs.map((n, i) => {
                                    const [c, bg, lbl] = cmap[n.clas] || [F.gray3, F.gray6, "—"];
                                    return (
                                      <div key={i} style={{ background: bg, border: `1px solid ${c}33`, borderRadius: 6, padding: "8px 12px" }}>
                                        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                          <span style={{ fontSize: 9.5, fontWeight: 700, padding: "1px 6px", borderRadius: 3, background: `${c}22`, color: c, fontFamily: "'Barlow Condensed',sans-serif", textTransform: "uppercase", flexShrink: 0, marginTop: 1 }}>{lbl}</span>
                                          <div>
                                            <div style={{ fontSize: 12.5, color: F.charcoal }}>{n.q}</div>
                                            {n.evidencia && <div style={{ fontSize: 11.5, color: F.gray3, marginTop: 3 }}>📎 {n.evidencia.startsWith("http") ? <a href={n.evidencia} target="_blank" rel="noreferrer" style={{ color: F.red, fontWeight: 600 }}>↗ Ver documento</a> : n.evidencia}</div>}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Ciência + Comentários */}
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingTop: 10, borderTop: `1px solid ${F.gray6}` }}>
                              {a.ciencia?.confirmado
                                ? <Pill color={F.green} bg={F.greenDim}>✓ Ciência: {a.ciencia.responsavel} · {fmtDate(a.ciencia.data)}</Pill>
                                : <Pill color={F.amber} bg={F.amberDim}>⏳ Ciência pendente</Pill>}
                              {a.comentarios?.length > 0 && <Tag color={F.blue} bg={F.blueDim}>{a.comentarios.length} comentário{a.comentarios.length !== 1 ? "s" : ""} do comitê</Tag>}
                              {consol && <Tag color={F.blue} bg={F.blueDim}>Consolidado de {consol.auditorLiderNome}</Tag>}
                              <div style={{ marginLeft: "auto" }}>
                                <button onClick={() => { setViewRelatorioAudId(a.id); }} style={{ fontSize: 11.5, color: F.red, background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "'Barlow',sans-serif" }}>🖨 Gerar PDF</button>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── CONSOLIDAR AUDITORIAS ── */}
            {view === "consolidar" && (() => {
              // Agrupa auditorias por área+ciclo com 2+ auditores
              const grupos = {};
              db.auditorias.forEach(a => {
                if (!a.cicloNome || a.cicloNome === "—") return;
                const k = `${a.areaId}||${a.cicloNome}`;
                if (!grupos[k]) grupos[k] = [];
                grupos[k].push(a);
              });
              const pares = Object.values(grupos).filter(g => g.length >= 2);

              return (
                <div>
                  {pares.length === 0 ? (
                    <Card>
                      <div style={{ textAlign: "center", padding: "48px 0" }}>
                        <div style={{ fontSize: 36, opacity: 0.15, marginBottom: 10 }}>⊕</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: F.gray3, marginBottom: 6 }}>Nenhum par de auditorias encontrado</div>
                        <div style={{ fontSize: 13, color: F.gray4 }}>Quando dois auditores auditarem a mesma área no mesmo ciclo, o par aparecerá aqui.</div>
                      </div>
                    </Card>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ fontSize: 12.5, color: F.gray3, background: F.blueDim, border: `1px solid ${F.blue}33`, borderRadius: 8, padding: "10px 14px" }}>
                        Auditorias realizadas por dois auditores na mesma área e ciclo. Consolide em um único relatório com a média dos resultados.
                      </div>
                      {pares.map(grupo => {
                        const [a1] = grupo;
                        const scoreMedia = Math.round(grupo.reduce((s, a) => s + a.score, 0) / grupo.length);
                        const ncsUnidas = grupo.flatMap(a => (a.ncs || []).map(n => ({ ...n, auditorNome: a.auditorNome })));
                        const consolidacao = db.consolidacoes.find(c => c.areaId === a1.areaId && c.cicloNome === a1.cicloNome);
                        const key = `${a1.areaId}-${a1.cicloNome}`;
                        const scores = grupo.map(a => a.score);
                        const difScore = grupo.length >= 2 ? Math.abs(scores[0] - scores[1]) : 0;
                        const grandeDisparidade = difScore > 20;
                        return (
                          <Card key={key} style={{ border: `1.5px solid ${grandeDisparidade && !consolidacao ? F.red : consolidacao ? F.green : F.amber}` }}>
                            {/* Alerta de disparidade */}
                            {grandeDisparidade && (
                              <div style={{ background: F.redDim, border: `1px solid ${F.redBorder}`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: F.red }}>
                                    ⚠ Disparidade de {difScore}% entre os auditores
                                  </div>
                                  <div style={{ fontSize: 12, color: F.gray3, marginTop: 2 }}>
                                    {grupo.map(a => `${a.auditorNome}: ${a.score}%`).join(" · ")} — diferença acima de 20%. Recomenda-se refazer a auditoria.
                                  </div>
                                </div>
                                {podeExecutar(perfil, "auditar") && (
                                  <Btn onClick={() => {
                                    setAudStep(1);
                                    setAudForm({ areaId: a1.areaId, cicloId: db.ciclos.find(c => c.nome === a1.cicloNome)?.id || "", data: new Date().toISOString().split("T")[0] });
                                    setChecklist([]);
                                    openModal("auditoria");
                                  }} style={{ background: F.red, border: "none", color: "#fff", flexShrink: 0 }}>
                                    ↺ Refazer Auditoria
                                  </Btn>
                                )}
                              </div>
                            )}
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                                  <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 900, color: F.charcoal }}>{a1.areaNome}</div>
                                  <Tag>{a1.cicloNome}</Tag>
                                  {consolidacao ? <Pill color={F.green} bg={F.greenDim}>Consolidado</Pill> : grandeDisparidade ? <Pill color={F.red} bg={F.redDim}>Disparidade Alta</Pill> : <Pill color={F.amber} bg={F.amberDim}>Aguardando consolidação</Pill>}
                                </div>
                              </div>
                              <div style={{ textAlign: "center", flexShrink: 0 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: F.gray4, textTransform: "uppercase", letterSpacing: 1, fontFamily: "'Barlow Condensed',sans-serif" }}>Média</div>
                                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 38, fontWeight: 900, color: scoreColor(scoreMedia), lineHeight: 1 }}>{scoreMedia}%</div>
                                <div style={{ fontSize: 10, color: scoreColor(scoreMedia), fontWeight: 700, textTransform: "uppercase" }}>{scoreLabel(scoreMedia)}</div>
                              </div>
                            </div>

                            {/* Cards dos auditores */}
                            <div style={{ display: "grid", gridTemplateColumns: `repeat(${grupo.length}, 1fr)`, gap: 10, marginBottom: 16 }}>
                              {grupo.map(a => (
                                <div key={a.id} style={{ background: F.offWhite, borderRadius: 8, padding: "12px 14px", border: `1px solid ${F.gray6}` }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: F.gray4, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 4 }}>Auditor</div>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: F.charcoal }}>{a.auditorNome}</div>
                                  <div style={{ fontSize: 11, color: F.gray4, marginTop: 2 }}>{fmtDate(a.data)}</div>
                                  <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 26, fontWeight: 900, color: scoreColor(a.score), marginTop: 6 }}>{a.score}%</div>
                                  <div style={{ fontSize: 11, color: F.gray3, marginTop: 4 }}>{(a.ncs || []).filter(n => n.clas === "nc").length} NC · {(a.ncs || []).filter(n => n.clas === "mel").length} Melhoria</div>
                                </div>
                              ))}
                            </div>

                            {/* NCs unidas */}
                            {ncsUnidas.length > 0 && (
                              <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: F.gray4, fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 8 }}>
                                  Não Conformidades consolidadas ({ncsUnidas.length})
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  {ncsUnidas.map((n, i) => {
                                    const cmap = { nc: [F.red, F.redDim, "NC"], mel: [F.blue, F.blueDim, "Melhoria"], obs: [F.gray3, F.gray6, "Obs"] };
                                    const [c, bg, lbl] = cmap[n.clas] || [F.gray3, F.gray6, "—"];
                                    return (
                                      <div key={i} style={{ background: bg, border: `1px solid ${c}33`, borderRadius: 7, padding: "8px 12px" }}>
                                        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                          <span style={{ fontSize: 9.5, fontWeight: 700, padding: "1px 6px", borderRadius: 3, background: `${c}22`, color: c, fontFamily: "'Barlow Condensed',sans-serif", textTransform: "uppercase", whiteSpace: "nowrap", marginTop: 1 }}>{lbl}</span>
                                          <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 12.5 }}>{n.q}</div>
                                            {n.evidencia && <div style={{ fontSize: 11, color: F.gray3, marginTop: 2 }}>Evidência: {n.evidencia}</div>}
                                            <div style={{ fontSize: 10, color: F.gray4, marginTop: 2 }}>— {n.auditorNome}</div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Relatório consolidado existente */}
                            {consolidacao && (
                              <div style={{ background: F.greenDim, border: `1px solid ${F.green}44`, borderRadius: 8, padding: "12px 14px", marginBottom: 12 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: F.green, marginBottom: 8 }}>✓ Relatório consolidado por {consolidacao.auditorLiderNome} · {fmtDate(consolidacao.criadoEm?.split("T")[0])}</div>
                                {consolidacao.conclusoes && <div style={{ fontSize: 12.5, marginBottom: 4 }}><strong>Conclusões:</strong> {consolidacao.conclusoes}</div>}
                                {consolidacao.recomendacoes && <div style={{ fontSize: 12.5, marginBottom: 4 }}><strong>Recomendações:</strong> {consolidacao.recomendacoes}</div>}
                                {consolidacao.observacoes && <div style={{ fontSize: 12.5 }}><strong>Obs.:</strong> {consolidacao.observacoes}</div>}
                              </div>
                            )}

                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                              <Btn onClick={() => setConsolidandoPar({ grupo, scoreMedia, ncsUnidas, consolidacao })}
                                style={{ background: consolidacao ? F.gray2 : F.blue, border: "none", color: "#fff" }}>
                                {consolidacao ? "✎ Editar Relatório Consolidado" : "⊕ Consolidar e Gerar Relatório Final"}
                              </Btn>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

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
                      <TD>
                        <strong>{a.areaNome}</strong>
                        {a.atividadeTexto && <div style={{ fontSize: 11.5, color: F.gray3, lineHeight: 1.4, marginTop: 2 }}>{a.atividadeTexto}</div>}
                        {a.local && <div style={{ fontSize: 11, color: F.gray4 }}>{a.local}</div>}
                        {a.processosAuditados?.length > 0 && (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                            {a.processosAuditados.map(pid => {
                              const proc = db.processos.find(p => p.id === pid);
                              return proc ? <Tag key={pid} color={F.blue} bg={F.blueDim}>{proc.nome}</Tag> : null;
                            })}
                          </div>
                        )}
                      </TD>
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
                      {podeExecutar(perfil, "excluir") && <TD><button onClick={() => excluirAuditoria(a)} style={{ background: "none", border: "none", color: F.gray4, cursor: "pointer", fontSize: 16, padding: "2px 6px" }}>✕</button></TD>}
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
            {/* ── PLANOS ── */}
            {view === "planos" && (
              <div>

                {/* ── VIEW CARDS GESTOR ── */}
                {perfil === "gestor" && planosAprovados.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: F.gray4, marginBottom: 12 }}>
                      Meus Relatórios de Conclusão ({planosAprovados.length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {planosAprovados.map(p => {
                        const at = isAtrasado(p);
                        const cmap = { nc: [F.red, F.redDim, "Não Conformidade"], mel: [F.blue, F.blueDim, "Melhoria"], obs: [F.gray3, F.gray6, "Obs"] };
                        const [cc, cbg, clbl] = cmap[p.clas] || [F.gray3, F.gray6, "—"];
                        const prioMap = { high: [F.red, "Alta"], mid: [F.amber, "Média"], low: [F.green, "Baixa"] };
                        const [pCor, pLbl] = prioMap[p.prio] || [F.gray3, "—"];
                        const statusMap = {
                          aberto:    { cor: F.gray3, label: "Aberto" },
                          andamento: { cor: F.blue,  label: "Em Andamento" },
                          concluido: { cor: F.green, label: "Concluído" },
                        };
                        return (
                          <Card key={p.id} style={{ border: `1.5px solid ${at ? F.red : p.status === "concluido" ? F.green : F.gray6}` }}>
                            {/* Cabeçalho */}
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 6 }}>
                                  <Tag color={cc} bg={cbg}>{clbl}</Tag>
                                  <span style={{ fontSize: 10.5, fontWeight: 700, color: pCor, background: `${pCor}15`, padding: "2px 8px", borderRadius: 20, fontFamily: "'Barlow Condensed',sans-serif" }}>● {pLbl}</span>
                                  {at && <Tag color={F.red} bg={F.redDim}>⚠ Atrasado</Tag>}
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: F.charcoal, lineHeight: 1.4, marginBottom: 6 }}>{p.desc}</div>
                                <div style={{ fontSize: 11.5, color: F.gray4, display: "flex", gap: 14, flexWrap: "wrap" }}>
                                  {p.causaRaiz && <span>🔍 {p.causaRaiz}</span>}
                                  {p.respNome && <span>👤 {p.respNome}</span>}
                                  <span style={{ color: at ? F.red : F.gray4 }}>📅 Prazo: {fmtDate(p.prazo)}</span>
                                </div>
                              </div>
                              {/* Status visual */}
                              <div style={{ flexShrink: 0, textAlign: "right" }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: F.gray4, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontFamily: "'Barlow Condensed',sans-serif" }}>Status</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                  {["aberto","andamento","concluido"].map(s => {
                                    const { cor, label } = statusMap[s];
                                    const ativo = p.status === s;
                                    return (
                                      <button key={s} onClick={() => {
                                        const evt = { data: new Date().toISOString(), acao: `Status alterado para ${label}`, autor: usuarioLogado?.nome || "Sistema" };
                                        upd("planos", arr => arr.map(x => x.id === p.id ? { ...x, status: s, historico: [...(x.historico || []), evt] } : x));
                                      }} style={{
                                        padding: "5px 12px", borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "'Barlow',sans-serif",
                                        background: ativo ? cor : "transparent",
                                        color: ativo ? "#fff" : F.gray4,
                                        border: `1.5px solid ${ativo ? cor : F.gray6}`,
                                        transition: "all 0.12s"
                                      }}>
                                        {ativo ? "● " : "○ "}{label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            {/* Extensão pendente */}
                            {p.extensao?.status === "pendente" && (
                              <div style={{ background: F.amberDim, border: `1px solid ${F.amber}44`, borderRadius: 7, padding: "8px 12px", marginBottom: 12, fontSize: 12.5, color: F.charcoal }}>
                                <span style={{ fontWeight: 700, color: F.amber }}>⏳ Extensão solicitada</span> — novo prazo: {fmtDate(p.extensao.novoPrazo)} · Aguardando aprovação
                              </div>
                            )}

                            {/* Evidências de execução */}
                            <div style={{ borderTop: `1px solid ${F.gray6}`, paddingTop: 12, marginTop: 4 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: F.gray4, fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 8 }}>
                                📎 Evidências de Execução ({(p.evidenciasExecucao || []).length})
                              </div>
                              {(p.evidenciasExecucao || []).length > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
                                  {(p.evidenciasExecucao || []).map(ev => (
                                    <div key={ev.id} style={{ background: F.offWhite, borderRadius: 6, padding: "7px 10px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                                      <div style={{ flex: 1, fontSize: 12.5, color: F.charcoal }}>
                                        {ev.texto.startsWith("http")
                                          ? <a href={ev.texto} target="_blank" rel="noreferrer" style={{ color: F.red, fontWeight: 600 }}>↗ {ev.texto.length > 60 ? ev.texto.slice(0,60) + "…" : ev.texto}</a>
                                          : ev.texto}
                                      </div>
                                      <div style={{ fontSize: 10, color: F.gray4, flexShrink: 0 }}>{ev.autor} · {fmtDate(ev.data?.split("T")[0])}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <EvidenciaInline planoId={p.id} onSave={adicionarEvidenciaExecucao} />
                            </div>

                            {/* Rodapé: solicitar extensão + histórico */}
                            <div style={{ borderTop: `1px solid ${F.gray6}`, paddingTop: 10, marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div style={{ display: "flex", gap: 8 }}>
                                {at && !p.extensao && (
                                  <button onClick={() => setJustificandoPlano(p)} style={{ fontSize: 11.5, color: F.amber, background: F.amberDim, border: `1px solid ${F.amber}44`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontWeight: 700, fontFamily: "'Barlow',sans-serif" }}>
                                    ⏱ Solicitar Extensão de Prazo
                                  </button>
                                )}
                              </div>
                              <button onClick={() => setHistoricoPlanId(p.id)} style={{ fontSize: 11.5, color: F.gray4, background: "none", border: "none", cursor: "pointer", fontFamily: "'Barlow',sans-serif" }}>
                                ⊙ Ver Histórico
                              </button>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

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
                            {temExtPendente && podeExecutar(perfil, "aprovar") && (
                              <div style={{ marginTop: 4, display: "flex", gap: 5 }}>
                                <Tag color={F.amber} bg={F.amberDim}>Extensão Pendente</Tag>
                                <button onClick={() => aprovarExtensao(p.id)} style={{ fontSize: 10, background: F.green, color: "#fff", border: "none", borderRadius: 4, padding: "1px 7px", cursor: "pointer", fontWeight: 700 }}>✓</button>
                                <button onClick={() => rejeitarExtensao(p.id)} style={{ fontSize: 10, background: F.red, color: "#fff", border: "none", borderRadius: 4, padding: "1px 7px", cursor: "pointer", fontWeight: 700 }}>✕</button>
                              </div>
                            )}
                            {temExtPendente && !podeExecutar(perfil, "aprovar") && <Tag color={F.amber} bg={F.amberDim}>Extensão Pendente</Tag>}
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

            {/* ── CRONOGRAMA DE AUDITORIA ── */}
            {view === "cronograma" && (
              <CronogramaAuditoria
                somenteDe={perfil === "auditor" ? usuarioLogado.id : null}
                dados={db.cronograma || {}}
                usuarios={db.usuarios}
                auditorias={db.auditorias}
                onAuditar={podeExecutar(perfil, "auditar") ? (areaId, atividadeId, mes) => {
                  setAudStep(1); setChecklist([]);
                  const hoje = new Date().toISOString().split("T")[0];
                  const ciclo = db.ciclos.find(c => c.ini?.slice(0, 7) === mes) || db.ciclos.find(c => c.ini && c.fim && c.ini <= hoje && hoje <= c.fim);
                  setAudForm({ areaId, atividadeId, cronMes: mes, auditorId: usuarioLogado.id, data: hoje, cicloId: ciclo?.id || "" });
                  openModal("auditoria");
                } : null}
                podeEditar={perfil === "administrador"}
                onChange={(mes, itemId, campo, valor) => setDb(d => {
                  const cron = { ...(d.cronograma || {}) };
                  // Responsável se repete nos meses seguintes, até o último ciclo; datas e observações valem só para o mês
                  const meses = CAMPOS_RESPONSAVEL.includes(campo) ? mesesAte(mes, ultimoMesCiclos(d.ciclos)) : [mes];
                  meses.forEach(mm => {
                    const doMes = cron[mm] || {};
                    cron[mm] = { ...doMes, [itemId]: { ...(doMes[itemId] || {}), [campo]: valor } };
                  });
                  return { ...d, cronograma: cron };
                })}
                onRepetirResponsaveis={mes => {
                  if (!window.confirm("Repetir os responsáveis de todas as atividades deste mês em todos os meses seguintes? Os responsáveis já definidos nos meses seguintes serão substituídos.")) return;
                  setDb(d => {
                    const cron = { ...(d.cronograma || {}) };
                    const base = cron[mes] || {};
                    mesesAte(mes, ultimoMesCiclos(d.ciclos)).slice(1).forEach(mm => {
                      const doMes = { ...(cron[mm] || {}) };
                      Object.entries(base).forEach(([itemId, r]) => {
                        if (!CAMPOS_RESPONSAVEL.some(c => r[c])) return;
                        const resp = Object.fromEntries(CAMPOS_RESPONSAVEL.map(c => [c, r[c] || ""]));
                        doMes[itemId] = { ...(doMes[itemId] || {}), ...resp };
                      });
                      cron[mm] = doMes;
                    });
                    return { ...d, cronograma: cron };
                  });
                  showToast("Responsáveis repetidos nos meses seguintes!");
                }}
              />
            )}

            {/* ── AUDITORIAS BÔNUS ── */}
            {view === "bonus" && (
              <CronogramaAuditoria
                bonus
                somenteDe={perfil === "auditor" ? usuarioLogado.id : null}
                dados={db.cronograma || {}}
                usuarios={db.usuarios}
                auditorias={db.auditorias}
                onAuditar={podeExecutar(perfil, "auditar") ? (areaId, atividadeId, mes) => {
                  setAudStep(1); setChecklist([]);
                  const hoje = new Date().toISOString().split("T")[0];
                  const ciclo = db.ciclos.find(c => c.ini?.slice(0, 7) === mes) || db.ciclos.find(c => c.ini && c.fim && c.ini <= hoje && hoje <= c.fim);
                  setAudForm({ areaId, atividadeId, cronMes: mes, auditorId: usuarioLogado.id, data: hoje, cicloId: ciclo?.id || "" });
                  openModal("auditoria");
                } : null}
                podeEditar={perfil === "administrador"}
                onChange={(mes, itemId, campo, valor) => setDb(d => {
                  const cron = d.cronograma || {};
                  const doMes = cron[mes] || {};
                  return { ...d, cronograma: { ...cron, [mes]: { ...doMes, [itemId]: { ...(doMes[itemId] || {}), [campo]: valor } } } };
                })}
              />
            )}

            {/* ── DESPESAS FIXAS ── */}
            {view === "despesas" && <DespesasFixas podeEditar={perfil === "administrador" || perfil === "area-processos"} />}

            {/* ── CICLOS ── */}
            {view === "ciclos" && (
              <Card>
                <DataTable
                  cols={["Ciclo", "Início", "Fim", "Auditorias", "Status", ...(podeExecutar(perfil, "excluir") || podeExecutar(perfil, "gerir-ciclos") ? [""] : [])]}
                  rows={db.ciclos.map(c => {
                    const n = db.auditorias.filter(a => a.cicloNome === c.nome).length;
                    return <>
                      <TD><strong>{c.nome}</strong></TD>
                      <TD style={{ color: F.gray3 }}>{fmtDate(c.ini)}</TD>
                      <TD style={{ color: F.gray3 }}>{fmtDate(c.fim)}</TD>
                      <TD><Tag>{n} auditoria{n !== 1 ? "s" : ""}</Tag></TD>
                      <TD><Pill color={c.status === "ativo" ? F.green : F.gray3} bg={c.status === "ativo" ? F.greenDim : F.gray6}>{c.status === "ativo" ? "Ativo" : "Encerrado"}</Pill></TD>
                      {(podeExecutar(perfil, "excluir") || podeExecutar(perfil, "gerir-ciclos")) && (
                        <TD>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={() => openModal("ciclo", c)} style={{ background: F.offWhite, border: `1px solid ${F.gray6}`, borderRadius: 5, color: F.gray3, cursor: "pointer", fontSize: 13, padding: "3px 8px" }}>✎</button>
                            <button onClick={() => upd("ciclos", arr => arr.filter(x => x.id !== c.id))} style={{ background: "none", border: "none", color: F.gray4, cursor: "pointer", fontSize: 16, padding: "2px 6px" }}>✕</button>
                          </div>
                        </TD>
                      )}
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

      {/* ÁREA */}
      <AreaModal open={!!modals.area} onClose={() => closeModal("area")} modulos={db.modulos} area={modals.area} onSave={saveArea} />

      {/* PROCESSO */}
      <ProcessoModal open={!!modals.processo} onClose={() => closeModal("processo")} areas={AREAS_CRONOGRAMA} processo={modals.processo} onSave={saveProcesso} />

      {/* CICLO */}
      <CicloModal open={!!modals.ciclo} onClose={() => closeModal("ciclo")} ciclo={modals.ciclo} onSave={saveCiclo} />

      {/* USUÁRIO */}
      <UsuarioModal open={!!modals.usuario} onClose={() => closeModal("usuario")} areas={AREAS_CRONOGRAMA} onSave={saveUsuario} />

      {/* MEMBRO */}

      {/* PLANO */}
      <PlanoModal open={!!modals.plano} onClose={() => closeModal("plano")} areas={AREAS_CRONOGRAMA} usuarios={db.usuarios} onSave={f => { savePlano(f); }} />

      {/* CONSOLIDAÇÃO */}
      <ConsolidacaoModal
        open={!!consolidandoPar}
        onClose={() => setConsolidandoPar(null)}
        par={consolidandoPar}
        onSave={salvarConsolidacao}
      />

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
        areas={AREAS_CRONOGRAMA.filter(a => !a.naoAuditada && !a.noa)}
        usuarios={db.usuarios}
        ciclos={db.ciclos}
        processos={db.processos}
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

  const categOptions = ["CSC","FAST HOMES E OBRAS","FRANQUIAS","COMERCIAL","SUPLY","INDUSTRIA","LOGÍSTICA","UNITY"];
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

function ProcessoModal({ open, onClose, areas, processo, onSave }) {
  const empty = { nome: "", areaId: "", resp: "", link: "" };
  const [f, setF] = useState(empty);
  const isEdit = !!(processo && processo.id);
  useEffect(() => { if (open) setF(isEdit ? { ...empty, ...processo } : empty); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  function save() { onSave(f); setF(empty); }
  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Editar Processo" : "Novo Processo"} width={500}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={save}>{isEdit ? "Salvar Alterações" : "Salvar"}</Btn></>}>
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
    </Modal>
  );
}

function CicloModal({ open, onClose, ciclo, onSave }) {
  const empty = { nome: "", ini: "", fim: "", obs: "" };
  const [f, setF] = useState(empty);
  const isEdit = !!(ciclo && ciclo.id);
  useEffect(() => { if (open) setF(isEdit ? { ...empty, ...ciclo } : empty); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  function save() { onSave(f); setF(empty); }
  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Editar Ciclo" : "Novo Ciclo"} width={480}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={save}>{isEdit ? "Salvar Alterações" : "Criar Ciclo"}</Btn></>}>
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
            {[["administrador","Administrador"],["area-processos","Área de Processos"],["auditor","Auditor"],["gestor","Gestor de Área"],["diretoria","Diretoria"],["operacional","Operacional"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
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


function PlanoModal({ open, onClose, areas, usuarios, onSave }) {
  const empty = { desc: "", areaId: "", respId: "", respNome: "", prio: "high", prazo: "", clas: "nc", causaRaiz: "" };
  const [f, setF] = useState(empty);
  function save() {
    const area = areas.find(a => a.id === f.areaId);
    const resp = usuarios.find(u => u.id === f.respId);
    onSave({ ...f, desc: U(f.desc), areaNome: area?.nome || "—", respNome: resp?.nome || f.respNome });
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
  .evidencia { font-size:11.5px; margin-top:6px; color:#555; white-space:pre-wrap; }
  .elaborador { font-size:11.5px; color:#888; margin-bottom:22px; padding:10px 14px; background:#F5F4F2; border-radius:7px; }
  .footer { margin-top:40px; padding-top:14px; border-top:1px solid #E5E5E5; font-size:11px; color:#aaa; text-align:center; }
  .print-btn { position:fixed; bottom:24px; right:24px; background:#E8001D; color:#fff; border:none; padding:11px 22px; border-radius:7px; font-size:13px; font-weight:700; cursor:pointer; box-shadow:0 4px 16px rgba(232,0,29,0.35); }
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
        ${n.obs ? `<div class="evidencia"><strong>Detalhamento:</strong> ${n.obs}</div>` : ""}
        ${n.chamado ? `<div class="evidencia"><strong>Chamado / SharePoint:</strong> ${n.chamado}</div>` : ""}
      </div>`;
    }).join("")}
  </div>
</div>` : ""}

${auditoria.itensVerificados?.length > 0 ? `
<div class="secao">
  <div class="sec-titulo">Itens Verificados (${auditoria.itensVerificados.length})</div>
  <div class="ncs-lista">
    ${auditoria.itensVerificados.map(it => {
      const lbl = { ok: "Conforme", nok: "Não conforme", na: "N/A" }[it.resp] || "Sem resposta";
      return `<div class="nc-item" style="background:#FFFFFF;border:1px solid #E5E5E5">
        <span class="nc-tag" style="background:#F5F4F2;color:#555555">${lbl}</span>${it.q}
        ${it.obs ? `<div class="evidencia"><strong>Detalhamento:</strong> ${it.obs}</div>` : ""}
        ${it.evidencia ? `<div class="evidencia"><strong>Evidência:</strong> ${it.evidencia}</div>` : ""}
        ${it.chamado ? `<div class="evidencia"><strong>Chamado / SharePoint:</strong> ${it.chamado}</div>` : ""}
      </div>`;
    }).join("")}
  </div>
</div>` : ""}

${auditoria.comentarios?.length > 0 ? `
<div class="secao">
  <div class="sec-titulo">Comentários (${auditoria.comentarios.length})</div>
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

function ConsolidacaoModal({ open, onClose, par, onSave }) {
  const [f, setF] = useState({ conclusoes: "", recomendacoes: "", observacoes: "" });
  useEffect(() => {
    if (open && par) {
      const c = par.consolidacao;
      setF({ conclusoes: c?.conclusoes || "", recomendacoes: c?.recomendacoes || "", observacoes: c?.observacoes || "" });
    }
  }, [open, par]);
  if (!par) return null;
  const { grupo, scoreMedia, ncsUnidas } = par;
  const [a1] = grupo;
  return (
    <Modal open={open} onClose={onClose} title="Consolidar Auditorias e Gerar Relatório Final" width={620}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={() => { if (!f.conclusoes.trim()) { alert("Informe as conclusões."); return; } onSave({ areaId: a1.areaId, areaNome: a1.areaNome, cicloNome: a1.cicloNome, auditoriaIds: grupo.map(a => a.id), scoreMedia, ncsCount: ncsUnidas.length, ...f }); onClose(); }}>✓ Consolidar e Gerar Relatório Final</Btn></>}>

      {/* Resumo */}
      <div style={{ background: F.offWhite, borderRadius: 8, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 900, color: F.charcoal }}>{a1.areaNome}</div>
          <div style={{ fontSize: 11.5, color: F.gray4, marginTop: 2 }}>Ciclo: {a1.cicloNome} · {grupo.length} auditores · {ncsUnidas.length} NCs</div>
          <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            {grupo.map(a => <Tag key={a.id} color={scoreColor(a.score)} bg={`${scoreColor(a.score)}18`}>{a.auditorNome}: {a.score}%</Tag>)}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 36, fontWeight: 900, color: scoreColor(scoreMedia), lineHeight: 1 }}>{scoreMedia}%</div>
          <div style={{ fontSize: 10, color: scoreColor(scoreMedia), fontWeight: 700, textTransform: "uppercase" }}>Média Consolidada</div>
        </div>
      </div>

      <div style={{ background: F.blueDim, border: `1px solid ${F.blue}33`, borderRadius: 7, padding: "9px 14px", marginBottom: 14, fontSize: 12.5, color: F.blue }}>
        Este relatório será salvo como <strong>Relatório Final</strong> em ambas as auditorias — não é necessário elaborar separadamente.
      </div>

      <FG label="Conclusões Consolidadas *">
        <textarea style={{ ...fi, resize: "vertical", minHeight: 90 }} value={f.conclusoes} onChange={e => setF({ ...f, conclusoes: e.target.value })} placeholder="Síntese das conclusões das duas auditorias..." />
      </FG>
      <FG label="Recomendações">
        <textarea style={{ ...fi, resize: "vertical", minHeight: 70 }} value={f.recomendacoes} onChange={e => setF({ ...f, recomendacoes: e.target.value })} placeholder="Ações e melhorias recomendadas pelo Auditor..." />
      </FG>
      <FG label="Observações do Auditor">
        <textarea style={{ ...fi, resize: "vertical", minHeight: 60 }} value={f.observacoes} onChange={e => setF({ ...f, observacoes: e.target.value })} placeholder="Contexto adicional, pontos de convergência ou divergência entre os auditores..." />
      </FG>
    </Modal>
  );
}

function RelatorioFinalViewModal({ open, onClose, auditoria }) {
  if (!auditoria?.relatorioFinal) return null;
  const r = auditoria.relatorioFinal;
  const ncc = auditoria.ncs?.filter(n => n.clas === "nc").length || 0;
  const mel = auditoria.ncs?.filter(n => n.clas === "mel").length || 0;
  const obs = auditoria.ncs?.filter(n => n.clas === "obs").length || 0;
  const cmap = { nc: [F.red, F.redDim, "NC"], mel: [F.blue, F.blueDim, "Melhoria"], obs: [F.gray3, F.gray6, "Obs"] };
  return (
    <Modal open={open} onClose={onClose} title="Relatório Final de Auditoria" width={680}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
          <Btn variant="ghost" onClick={onClose}>Fechar</Btn>
          <Btn onClick={() => gerarPDFRelatorioFinal(auditoria)} style={{ background: F.red, border: "none", color: "#fff" }}>🖨 Salvar PDF</Btn>
        </div>
      }>

      {/* Cabeçalho */}
      <div style={{ background: F.offWhite, borderRadius: 10, padding: "14px 16px", marginBottom: 16, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 900, color: F.charcoal }}>{auditoria.areaNome}</div>
          <div style={{ fontSize: 12, color: F.gray4, marginTop: 3 }}>
            Auditado em {fmtDate(auditoria.data)} · {auditoria.auditorNome}
            {auditoria.cicloNome && auditoria.cicloNome !== "—" && ` · Ciclo: ${auditoria.cicloNome}`}
            {auditoria.local && ` · ${auditoria.local}`}
          </div>
          <div style={{ fontSize: 11, color: F.gray4, marginTop: 4 }}>
            Elaborado por <strong style={{ color: F.charcoal }}>{r.auditorNome}</strong> em {fmtDate(r.data?.split("T")[0])}
            {r.consolidado && <span style={{ marginLeft: 8, background: F.blueDim, color: F.blue, padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>Consolidado</span>}
          </div>
        </div>
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 40, fontWeight: 900, color: scoreColor(auditoria.score), lineHeight: 1 }}>{auditoria.score}%</div>
          <div style={{ fontSize: 10, color: scoreColor(auditoria.score), fontWeight: 700, textTransform: "uppercase" }}>{scoreLabel(auditoria.score)}</div>
        </div>
      </div>

      {/* Contadores NCs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
        {[[ncc, "Não Conformidades", F.red, F.redDim],[mel, "Melhorias", F.blue, F.blueDim],[obs, "Observações", F.gray3, F.gray6]].map(([v, l, c, bg]) => (
          <div key={l} style={{ background: bg, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 28, fontWeight: 900, color: c, lineHeight: 1 }}>{v}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: c, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 3 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Conclusões, Recomendações, Observações */}
      {[["Conclusões da Auditoria", r.conclusoes], ["Recomendações", r.recomendacoes], ["Observações Adicionais", r.observacoes]].filter(([, v]) => v).map(([label, valor]) => (
        <div key={label} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: F.gray4, fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 13, color: F.charcoal, lineHeight: 1.8, background: F.offWhite, borderRadius: 7, padding: "10px 14px" }}>{valor}</div>
        </div>
      ))}

      {/* NCs com evidências */}
      {auditoria.ncs?.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: F.gray4, fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 8 }}>
            Não Conformidades e Evidências ({auditoria.ncs.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {auditoria.ncs.map((n, i) => {
              const [c, bg, lbl] = cmap[n.clas] || [F.gray3, F.gray6, "—"];
              return (
                <div key={i} style={{ background: bg, border: `1px solid ${c}33`, borderRadius: 7, padding: "10px 12px" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 9.5, fontWeight: 700, padding: "1px 6px", borderRadius: 3, background: `${c}22`, color: c, fontFamily: "'Barlow Condensed',sans-serif", textTransform: "uppercase", flexShrink: 0, marginTop: 2 }}>{lbl}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: F.charcoal }}>{n.q}</div>
                      {n.evidencia && (
                        <div style={{ marginTop: 5, fontSize: 12, color: F.gray3, background: "#fff", borderRadius: 5, padding: "5px 8px", border: `1px solid ${c}22` }}>
                          <strong style={{ color: F.gray4 }}>Evidência: </strong>
                          {n.evidencia.startsWith("http")
                            ? <a href={n.evidencia} target="_blank" rel="noreferrer" style={{ color: F.red, fontWeight: 600 }}>↗ Acessar documento</a>
                            : n.evidencia}
                        </div>
                      )}
                      {n.obs && <div style={{ marginTop: 5, fontSize: 12, color: F.gray3, whiteSpace: "pre-wrap" }}><strong style={{ color: F.gray4 }}>Detalhamento: </strong>{n.obs}</div>}
                      {n.chamado && <div style={{ marginTop: 3, fontSize: 12, color: F.gray3 }}><strong style={{ color: F.gray4 }}>Chamado / SharePoint: </strong>{n.chamado}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Todos os itens verificados */}
      {auditoria.itensVerificados?.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: F.gray4, fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 8 }}>
            Itens Verificados ({auditoria.itensVerificados.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {auditoria.itensVerificados.map((it, i) => {
              const [lbl, c] = { ok: ["Conforme", F.green], nok: ["Não conforme", F.red], na: ["N/A", F.gray4] }[it.resp] || ["Sem resposta", F.gray4];
              return (
                <div key={i} style={{ border: `1px solid ${F.gray6}`, borderRadius: 7, padding: "10px 12px", fontSize: 12, color: F.gray3, lineHeight: 1.5 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ flex: 1, fontSize: 13, color: F.charcoal }}>{it.q}</div>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: c, whiteSpace: "nowrap" }}>{lbl}</span>
                  </div>
                  {it.obs && <div style={{ marginTop: 5, whiteSpace: "pre-wrap" }}><strong style={{ color: F.gray4 }}>Detalhamento: </strong>{it.obs}</div>}
                  {it.evidencia && <div style={{ marginTop: 3, whiteSpace: "pre-wrap" }}><strong style={{ color: F.gray4 }}>Evidência: </strong>{it.evidencia.startsWith("http") ? <a href={it.evidencia} target="_blank" rel="noreferrer" style={{ color: F.red, fontWeight: 600 }}>↗ Acessar documento</a> : it.evidencia}</div>}
                  {it.chamado && <div style={{ marginTop: 3 }}><strong style={{ color: F.gray4 }}>Chamado / SharePoint: </strong>{it.chamado}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ciência */}
      {auditoria.ciencia?.confirmado && (
        <div style={{ background: F.greenDim, border: `1px solid ${F.green}44`, borderRadius: 7, padding: "10px 14px", marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: F.green, textTransform: "uppercase", letterSpacing: 1, fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 4 }}>✓ Ciência Registrada</div>
          <div style={{ fontSize: 12.5, color: F.charcoal }}>{auditoria.ciencia.responsavel} · {fmtDate(auditoria.ciencia.data)}</div>
          {auditoria.ciencia.observacoes && <div style={{ fontSize: 12, color: F.gray3, marginTop: 4 }}>{auditoria.ciencia.observacoes}</div>}
        </div>
      )}

      {/* Comentários */}
      {auditoria.comentarios?.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: F.gray4, fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 8 }}>
            Comentários ({auditoria.comentarios.length})
          </div>
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
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={() => { if (!f.conclusoes.trim()) { alert("Informe as conclusões."); return; } onSave(auditoria.id, { conclusoes: U(f.conclusoes), recomendacoes: U(f.recomendacoes), observacoes: U(f.observacoes) }); }}>✓ Enviar ao Administrador</Btn></>}>
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
    onSave({ ...f, motivo: U(f.motivo) });
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

function AuditoriaModal({ open, onClose, step, setStep, form, setForm, checklist, setChecklist, areas, usuarios, ciclos, processos, buildChecklist, calcScore, onFinalizar }) {
  function next() {
    if (step === 1) {
      if (!form.areaId) { alert("Selecione uma área."); return; }
      setChecklist(buildChecklist(form.areaId, form.atividadeId));
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

  const sections = [...new Set(checklist.map(i => i.sec))];

  return (
    <Modal open={open} onClose={onClose} title={["Nova Auditoria","Checklist de Verificação","Resultado e Relatórios de Conclusão"][step-1]} width={820}
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
          <FG label="Área do cronograma">
            <select style={fi} value={form.areaId || ""} onChange={e => setForm({ ...form, areaId: e.target.value, atividadeId: "" })}>
              <option value="">Selecione uma área...</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </FG>
          {form.atividadeId && (
            <div style={{ background: F.offWhite, border: `1px solid ${F.gray6}`, borderRadius: 7, padding: "10px 12px", marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: F.gray4, textTransform: "uppercase", letterSpacing: 1, fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 4 }}>Atividade auditada</div>
              <div style={{ fontSize: 13, color: F.charcoal, lineHeight: 1.45 }}>{CRONOGRAMA_ITENS.flatMap(g => g.itens).find(i => i.id === form.atividadeId)?.texto}</div>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FG label="Auditor responsável">
              <select style={fi} value={form.auditorId || ""} onChange={e => setForm({ ...form, auditorId: e.target.value })}>
                <option value="">Selecione...</option>
                {usuarios.filter(u => ["administrador","auditor","gestor"].includes(u.perfil)).map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
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
          {/* Processos da área */}
          {form.areaId && (() => {
            const processosArea = (processos || []).filter(p => p.areaId === form.areaId && p.status !== "inativo");
            if (!processosArea.length) return null;
            const selecionados = form.processosAuditados || [];
            return (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: F.gray4, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontFamily: "'Barlow Condensed',sans-serif" }}>
                  Processos auditados nesta área
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {processosArea.map(p => {
                    const marcado = selecionados.includes(p.id);
                    return (
                      <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "8px 12px", borderRadius: 7, background: marcado ? F.blueDim : F.offWhite, border: `1.5px solid ${marcado ? F.blue : F.gray6}`, transition: "all 0.12s" }}>
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={e => setForm({ ...form, processosAuditados: e.target.checked ? [...selecionados, p.id] : selecionados.filter(id => id !== p.id) })}
                          style={{ accentColor: F.blue, width: 14, height: 14, flexShrink: 0 }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: F.charcoal }}>{p.nome}</div>
                          {p.resp && <div style={{ fontSize: 11, color: F.gray4 }}>Responsável: {p.resp}</div>}
                        </div>
                        {p.link && <a href={p.link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: F.red, fontWeight: 600 }}>↗ Doc</a>}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })()}

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
                      <DetalheAtividade item={item} />
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
                  {/* Registro da verificação — sempre visível */}
                  {(() => {
                    const setCampo = (campo, valor) => setChecklist(cl => cl.map(x => x.id === item.id ? { ...x, [campo]: valor } : x));
                    const rotulo = { fontSize: 10, fontWeight: 700, color: F.gray4, textTransform: "uppercase", letterSpacing: 1, fontFamily: "'Barlow Condensed',sans-serif", margin: "8px 0 3px" };
                    const area = { ...fi, fontSize: 12.5, textTransform: "none", resize: "vertical", lineHeight: 1.45 };
                    const faltaEvidencia = item.resp === "nok" && !item.evidencia?.trim();
                    return (
                      <div>
                        <div style={rotulo}>Detalhamento da verificação</div>
                        <textarea style={{ ...area, minHeight: 110 }} value={item.obs || ""} onChange={e => setCampo("obs", e.target.value)}
                          placeholder="Descreva o que foi verificado: quais contas, documentos, períodos e valores foram analisados, o que foi encontrado e a conclusão..." />
                        <div style={rotulo}>Evidência{item.resp === "nok" ? " (obrigatória)" : ""}</div>
                        <textarea style={{ ...area, minHeight: 64, borderColor: faltaEvidencia ? F.amber : F.gray6 }} value={item.evidencia || ""} onChange={e => setCampo("evidencia", e.target.value)}
                          placeholder="Qual foi a evidência: relatório, extrato, print, documento ou link..." />
                        {faltaEvidencia && <div style={{ fontSize: 10, color: F.amber, fontWeight: 700, marginTop: 3 }}>Evidência obrigatória</div>}
                        <div style={rotulo}>Nº do chamado / documento SharePoint</div>
                        <input style={{ ...fi, fontSize: 12.5, textTransform: "none" }} value={item.chamado || ""} onChange={e => setCampo("chamado", e.target.value)}
                          placeholder="Ex.: chamado 12345 ou link do documento no SharePoint" />
                      </div>
                    );
                  })()}
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
                      {item.obs && <div style={{ fontSize: 11, color: F.gray3, marginTop: 2, whiteSpace: "pre-wrap" }}>Detalhamento: {item.obs}</div>}
                      {item.evidencia && <div style={{ fontSize: 11, color: F.gray3, marginTop: 2, whiteSpace: "pre-wrap" }}>Evidência: {item.evidencia}</div>}
                      {item.chamado && <div style={{ fontSize: 11, color: F.gray3, marginTop: 2 }}>Chamado / SharePoint: {item.chamado}</div>}
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

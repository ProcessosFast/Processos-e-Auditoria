# Prompt Completo do Projeto — Portal de Gestão e Auditoria Interna
## Fast Sistemas Construtivos

---

## CONTEXTO DO PROJETO

Aplicação web React (Create React App) de gestão e auditoria interna para a Fast Sistemas Construtivos. Dados persistidos em `localStorage` (`portal-fast-db-v2`). Hospedada na Vercel, repositório no GitHub em `ProcessosFast/Processos-e-Auditoria`. Stack: React 19, Recharts, CSS inline com design system próprio.

---

## IDENTIDADE VISUAL

Paleta de cores:
- Vermelho Fast: `#E8001D` (primary)
- Fundo: `#F5F4F2`
- Carvão: `#1A1A1A`
- Fontes: Barlow Condensed (títulos) + Barlow (corpo)
- Todos os inputs e textareas salvam em **MAIÚSCULO** automaticamente (listener global + CSS `text-transform: uppercase`, exceto email, URL, date)

---

## PERFIS DE USUÁRIO

| Perfil | Cor | Descrição |
|---|---|---|
| `administrador` | `#E8001D` | Acesso total |
| `area-processos` | `#D4580A` | Admin sem funções de auditoria/comitê/gestor |
| `auditor-lider` | `#00875A` | Realiza auditorias, consolida, elabora relatório final, gerencia ciclos e comitê |
| `auditor` | `#00B050` | Realiza auditorias e elabora relatório final |
| `comite` | `#9b6dff` | Revisa resultados, comenta, vota em enquetes |
| `gestor` | `#0066CC` | Acompanha auditorias e planos da sua área, registra ciência |
| `diretoria` | `#FF8C00` | Visualização |
| `operacional` | `#555` | Visualização |

**Login:** tela de cards agrupados por perfil; clique expande e lista os usuários. Gestor seleciona sua área após login. Usuários padrão restaurados automaticamente na inicialização.

**Permissões:** funções `podeAcessar(perfil, viewId)` e `podeExecutar(perfil, acao)` centralizadas. Ações ocultas (não apenas desabilitadas) quando sem permissão.

---

## ESTRUTURA DE DADOS (`db`)

```js
{
  areas: [],        // áreas da empresa
  processos: [],    // processos cadastrados
  auditorias: [],   // auditorias realizadas
  planos: [],       // planos de ação (relatórios de conclusão)
  ciclos: [],       // ciclos de auditoria
  comite: [],       // membros do comitê
  usuarios: [],     // usuários do sistema
  modulos: [],      // categorias de avaliação (checklists personalizados)
  consolidacoes: [],// relatórios consolidados do auditor líder
  notificacoes: [], // notificações persistidas por usuário
}
```

---

## MODELO DE DADOS PRINCIPAL

### Área
```js
{ id, nome, categoria, naoAuditada, diretor: { nome, email },
  blocoPerguntas: [moduloId], subareas: [{ id, nome, responsaveis: [{ id, nome, email, cargo }] }] }
```
Categorias disponíveis: CSC / FAST HOMES E OBRAS / FRANQUIAS / COMERCIAL / SUPLY / INDUSTRIA / LOGÍSTICA / UNITY

### Processo
```js
{ id, nome, areaId, areaNome, resp, link }
```

### Auditoria
```js
{ id, areaNome, areaId, auditorNome, data, local, cicloNome, score,
  obs, status: "concluida", processosAuditados: [processoId],
  ncs: [{ q, clas, evidencia }],
  relatorioFinal: { conclusoes, recomendacoes, observacoes, auditorNome, data, status, consolidado },
  comite: { dataReuniao, status: "aguardando"|"realizada", realizadaEm, observacoes },
  ciencia: { responsavel, responsavelId, data, observacoes, confirmado },
  comentarios: [{ id, usuarioId, usuarioNome, texto, data }] }
```

### Plano de Ação
```js
{ id, desc, areaId, areaNome, respId, respNome, prio, prazo, clas, causaRaiz,
  status: "aberto"|"andamento"|"concluido",
  aprovacao: "pendente"|"aprovado"|"rejeitado",
  aguardaComite: bool, enqueteEnviada: bool,
  enqueteComite: { [usuarioId]: { voto, nome, data } | null },
  auditoriaId, origem: "auditoria"|"manual",
  aprovadoPor, aprovadoEm, rejeitadoPor, rejeitadoEm,
  extensao: { motivo, novoPrazo, solicitadoEm, status, aprovadoPor, aprovadoEm },
  evidenciasExecucao: [{ id, texto, data, autor }],
  historico: [{ data, acao, autor }] }
```

### Categoria de Avaliação (Módulo)
```js
{ id, nome, descricao, areaIds: [], processoIds: [],
  perguntas: [{ id, texto, peso: 1|2|3 }], ativo: bool }
```

### Ciclo
```js
{ id, nome, ini, fim, obs, status: "ativo"|"encerrado" }
```

### Consolidação
```js
{ id, areaId, areaNome, cicloNome, auditoriaIds: [], scoreMedia, ncsCount,
  conclusoes, recomendacoes, observacoes,
  auditorLiderId, auditorLiderNome, criadoEm }
```

### Notificação
```js
{ id, paraId, titulo, mensagem, tipo: "ciclo"|"reuniao"|"enquete"|"aprovacao"|"geral",
  meta: {}, data, lida: bool }
```

---

## VIEWS E FUNCIONALIDADES

### Dashboard
- 5 cards: Áreas Auditáveis, Auditorias Realizadas, Planos em Andamento, Ações em Atraso, Conformidade Geral
- **Kanban de Fluxo** no topo: colunas vermelhas = ação pendente do usuário atual (etapas: Novo Ciclo → Auditoria → Relatório Final → Reunião Comitê → Elaborar Planos → Enquete → Aprovação → Execução → Ciência)
- Gráficos: Conformidade por Área (barras), Planos de Ação (pizza), Evolução de Score (linha), Últimas Auditorias
- **Cronograma de Ciclos** com toggle Lista/Calendário — calendário mensal com ciclos coloridos por período
- Dashboard exclusivo do Gestor: score da área, evolução, histórico de auditorias, tabela com botão de ciência inline

### Áreas
- Campos: nome, categoria (8 opções Fast), diretor (nome + email), naoAuditada, categorias de avaliação vinculadas, subáreas com responsáveis
- Botão ✎ editar + ✕ excluir por linha

### Processos
- Campos: nome, área, responsável, link SharePoint
- Botão ✎ editar + ✕ excluir por linha
- Vinculados à área → aparecem como checkboxes no Step 1 da auditoria

### Auditorias — 3 Steps

**Step 1:** área, auditor, data, ciclo, local, processos auditados (checkboxes por área), categorias incluídas automaticamente

**Step 2 — Checklist:**
- Perguntas da "Verificação Geral" (6 fixas) + categorias vinculadas à área
- Botões OK/NOK/N/A por item
- Campo de evidência sempre visível (obrigatório para NOK)
- Badge âmbar "Importante" (peso 2) e vermelha "Crítico" (peso 3)
- Bloqueio de avanço se NOK sem evidência

**Step 3 — Resultado:**
- Score ponderado pelo peso das perguntas
- NCs com causa raiz obrigatória (8 opções: Processo inexistente, Processo inadequado, Falta de treinamento, Falha sistêmica, Comunicação inadequada, Indisciplina operacional, Falha de governança, Falha de controle)
- Itens Críticos NOK com borda dupla vermelha + badge "Item Crítico"
- Seleção de NCs que geram planos (checkbox por item)

Após finalizar: auditoria salva com `comite.status: "aguardando"`, planos gerados com `aguardaComite: true` (invisíveis ao gestor).

**Colunas na view:** Score Individual, Média do Ciclo (ponderada por ciclo), Ciência, Rel. Final, excluir

### ⊕ Consolidar Auditorias (Auditor Líder)
- Detecta pares de auditorias (mesma área + ciclo)
- Mostra scores individuais, média, NCs unificadas com atribuição por auditor
- **Alerta ≥20% de diferença:** banner vermelho + botão "↺ Refazer Auditoria"
- Modal único: Conclusões + Recomendações + Observações → salva como `relatorioFinal` em ambas as auditorias automaticamente

### 📋 Relatório de Conclusão
- View de **recebimento** dos relatórios elaborados pelo Auditor Líder
- Admin/Auditor/Comitê veem todos; Gestor vê apenas o consolidado da sua área
- Exibe: score, NCs/Melhorias/Obs, conclusões, recomendações, NCs com evidências, ciência, comentários do comitê
- Botão 🖨 Gerar PDF

### Comitê — 3 abas

**Reuniões:** auditorias aguardando reunião; admin agenda data → notificações automáticas para auditores + gestor da área + membros do comitê; marcar como realizada; "▶ Liberar Relatórios para o Gestor" → cria enquetes para membros do comitê

**Enquetes:** cada membro vota ✓ Aprovar / ✕ Reprovar por plano; histórico de votos

**Membros:** gerenciar representantes por área

Comitê pode adicionar comentários em cada auditoria (aparecem no relatório final e PDF)

### ✍ Elaborar Plano de Ação (Admin)
- Lista planos com `aguardaComite: true` e sem `enqueteEnviada`
- Formulário inline: descrição, responsável, prazo, causa raiz, prioridade
- Botão cinza "⏳ Preencha todos os campos" → verde "✓ Enviar para Enquete do Comitê" quando completo
- Ao enviar: plano sai de `aguardaComite`, enquete criada, notificações para comitê

### Planos de Ação
**Seção Aguardando Aprovação:** admin atribui responsável inline (select), aprova/rejeita com timestamp e autor

**Planos Aprovados:** avatar de iniciais do responsável, causa raiz, status, badge extensão pendente, botão Justificar Atraso, botão ⊙ Histórico

**View do Gestor:** cards individuais com botões de status (Aberto/Em Andamento/Concluído), evidências de execução (texto ou link), botão "⏱ Solicitar Extensão de Prazo"

### Categorias de Avaliação (Módulos)
- Card fixo "Verificação Geral" (somente leitura, 6 perguntas base)
- Cards customizados: nome, perguntas com peso (Normal/Importante/Crítico), áreas vinculadas, processos vinculados
- Toggle ativo/inativo; botão "Ver perguntas" expansível inline

### Ciclos
- Nome, início, fim, observações
- Botão ✎ editar
- **Ao criar:** notificação automática 📅 para todos Auditores e Auditores Líderes com áreas a auditar
- **No dashboard:** aparece como coluna "Iniciar Auditoria" vermelha no Kanban se ciclo ativo sem auditorias

### Ciência do Auditado (Gestor)
- Banner verde automático na tela inicial do gestor
- Modal: data + observações (opcional) + checkbox obrigatório de confirmação
- Botão "Registrar" também na coluna Ciência da view de Auditorias

---

## FUNCIONALIDADES TRANSVERSAIS

### Score Ponderado
`calcScore`: aplica peso (1/2/3) de cada item; itens N/A excluídos; média ponderada = (soma pesos OK / soma pesos aplicáveis) × 100

Score por Área considera média dos ciclos (cada ciclo tem peso igual independente do número de auditores)

### Notificações (Bell)
Lê de duas fontes: estado de sessão (novos planos, prazos) + `db.notificacoes` (persistidas). Ícones: 📅 ciclo, ⏳ aprovação, ⏰ prazo. Marcar lidas individualmente ou todas.

### Histórico de Planos
Todo plano tem `historico: []`; registra automaticamente: criação, mudança de status, aprovação/rejeição, extensões solicitadas/aprovadas/rejeitadas, liberação pelo comitê.

### Exportação
**Relatório Geral (Dashboard):** HTML com logo embutida em base64, 4 seções, botão impressão

**Relatório Final de Auditoria (PDF):** logo Fast, score, contadores NCs/Melhorias/Obs, todas as seções do relatório, NCs com evidências, ciência, comentários do comitê, data da reunião do comitê

### Responsividade Mobile
- Sidebar como drawer com botão ☰ e overlay
- Modais como bottom-sheet (surgem de baixo, 100% largura)
- Grids adaptáveis (5→2 colunas, 2→1 coluna)
- Tabelas com scroll horizontal (`overflow-x: auto`)
- Padding reduzido nos conteúdos

### Manual de Instruções
Acessível via botão "? Suporte" na topbar → `/manual.html?perfil=X`. Filtra seções automaticamente por perfil via JavaScript. Inclui mockups visuais das telas, tabelas de campos, fluxogramas.

### Reset de Dados
Botão 🗑 no rodapé sidebar (somente Admin) → limpa `localStorage` + reload. Usuários padrão restaurados automaticamente.

---

## FLUXO COMPLETO DE AUDITORIA

```
Admin cria Ciclo
  ↓ notificação para auditores
Auditor realiza Auditoria (Steps 1→2→3)
  ↓ planos gerados (aguardaComite: true, invisíveis ao gestor)
Auditor/Auditor Líder elabora Relatório Final
  ↓ (se 2 auditores no mesmo ciclo → Consolidar)
Admin agenda Reunião do Comitê
  ↓ notificações automáticas
Comitê revisa + comenta
Admin marca Reunião Realizada
Admin libera Relatórios para o Gestor
  ↓ enquetes criadas para membros do comitê
Comitê vota (Aprovar/Reprovar) por plano
Admin elabora Planos de Ação (preenche campos)
  ↓ envia para enquete adicional
Admin aprova formalmente os planos
Gestor executa planos (status + evidências)
Gestor registra Ciência da Auditoria
```

---

## DETALHES TÉCNICOS

- **Chave localStorage:** `portal-fast-db-v2`
- **Maiúsculo automático:** listener global DOM intercepta todos os inputs antes do React processar; preserva cursor; ignora email/url/date/campos com placeholder "http"
- **Backward compat:** campos antigos (`noa`, `grupo`, `resp`, `fin`, `cli`, `cus`) reconhecidos por fallback
- **Sem backend:** 100% client-side, sem autenticação real (sem senha)
- **CI/CD:** Vercel — deploy automático em push para `main` no GitHub
- **Logo:** SVG embutida em base64 nos PDFs gerados
- **ESLint:** sem warnings — `eslint-disable` cirúrgicos apenas onde necessário

---

## USUÁRIOS PADRÃO (restaurados automaticamente)

| ID | Nome | Iniciais | Perfil |
|---|---|---|---|
| u-admin | Administrador | AD | administrador |
| u-area-processos | Área de Processos | AP | area-processos |
| u-auditor-lider | Auditor Líder | AL | auditor-lider |
| u-auditor | Auditor | AU | auditor |
| u-comite | Comitê | CO | comite |
| u-gestor | Gestor da Área | GA | gestor |

---

## REPOSITÓRIO E DEPLOY

- **GitHub:** https://github.com/ProcessosFast/Processos-e-Auditoria.git
- **Branch principal:** `main`
- **Vercel:** deploy automático a cada push
- **Manual:** `/manual.html?perfil={perfil}` (filtrado por perfil)
- **Build:** `npm run build` — saída em `/build`

---

*Fast Sistemas Construtivos — Portal de Gestão e Auditoria Interna — 2026*

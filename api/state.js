const { Redis } = require("@upstash/redis");

// Todo o portal fica num hash do Redis (pa:db), com um campo por registro.
// Assim duas pessoas editando registros diferentes ao mesmo tempo não se sobrescrevem.
// O prefixo "pa:" permite usar o mesmo banco dos outros portais ("fp:", "py:").
// Documentos grandes ficam em hashes próprios (?doc=...), carregados só quando a tela abre.
const CHAVE = "pa:db";
const DOCS = { despesas: "pa:despesas" };

// A integração da Vercel pode criar as variáveis com prefixo (ex.: STORAGE_KV_REST_API_URL).
function findEnv(suffixes) {
  const name = Object.keys(process.env).find(
    key => suffixes.some(suffix => key.endsWith(suffix)) && !key.includes("READ_ONLY"),
  );
  return name ? process.env[name] : undefined;
}

const url = findEnv(["KV_REST_API_URL", "REDIS_REST_URL"]);
const token = findEnv(["KV_REST_API_TOKEN", "REDIS_REST_TOKEN"]);

const redis = url && token ? new Redis({ url, token, automaticDeserialization: false }) : null;

// Sem desserialização automática o HGETALL pode vir como lista plana [campo, valor, ...].
function entries(raw) {
  if (!raw) return [];
  if (!Array.isArray(raw)) return Object.entries(raw);
  const pairs = [];
  for (let i = 0; i < raw.length; i += 2) pairs.push([raw[i], raw[i + 1]]);
  return pairs;
}

async function readAll(chave) {
  const raw = await redis.hgetall(chave);
  return Object.fromEntries(entries(raw).map(([k, v]) => [k, JSON.parse(v)]));
}

async function applyPatches(chave, patches) {
  const toSet = {};
  const toDel = [];
  for (const [key, value] of Object.entries(patches || {})) {
    if (value === null) toDel.push(key);
    else toSet[key] = JSON.stringify(value);
  }
  const pipe = redis.pipeline();
  if (Object.keys(toSet).length) pipe.hset(chave, toSet);
  if (toDel.length) pipe.hdel(chave, ...toDel);
  if (Object.keys(toSet).length || toDel.length) await pipe.exec();
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!redis) {
    // Só os nomes, nunca os valores, para diagnosticar a configuração.
    const names = Object.keys(process.env).filter(k => /KV|REDIS|UPSTASH/i.test(k));
    return res.status(503).json({ error: "redis not configured", envNames: names });
  }
  const doc = req.query && req.query.doc;
  const chave = doc ? DOCS[doc] : CHAVE;
  if (!chave) return res.status(400).json({ error: "unknown doc" });
  try {
    if (req.method === "GET") {
      return res.status(200).json({ items: await readAll(chave) });
    }
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (JSON.stringify(body || {}).length > 4000000) {
        return res.status(413).json({ error: "payload too large" });
      }
      if (body && body.init) {
        // Carga inicial: só entra se o documento ainda não foi carregado
        const primeira = await redis.set(`${chave}:init`, "1", { nx: true });
        if (primeira) await applyPatches(chave, body.init);
        return res.status(200).json({ ok: true, carregado: !!primeira });
      }
      await applyPatches(chave, body && body.patches);
      return res.status(200).json({ ok: true });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method not allowed" });
  } catch (error) {
    return res.status(500).json({ error: String((error && error.message) || error) });
  }
};

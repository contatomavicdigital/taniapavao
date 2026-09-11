import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Caminho do prompt-motor. Fica fora do bundle da function, então é lido em runtime. */
export const PROMPT_PATH = join(__dirname, "..", "prompts", "PROMPT_ROTA_MILHAS_TANIA.md");

let promptCache = null;
async function lerPrompt() {
  if (!promptCache) promptCache = await readFile(PROMPT_PATH, "utf-8");
  return promptCache;
}

// Só os 5 primeiros aparecem no formulário. O resto é opcional, usado
// quando a Tania está montando uma cotação personalizada e já conhece o perfil.
const CAMPOS = [
  ["origem", "ORIGEM", true],
  ["destino", "DESTINO", true],
  ["ida", "DATA DE IDA", true],
  ["volta", "DATA DE VOLTA", false],
  ["passageiros", "NÚMERO DE PASSAGEIROS", true],
  ["cabine", "CABINE", false],
  ["flexibilidade", "FLEXIBILIDADE DE DATAS (dias)", false],
  ["milheiro", "CUSTO DO MILHEIRO (R$)", false],
  ["programas", "PROGRAMAS QUE O CLIENTE JÁ TEM (e saldo)", false],
  ["pontosBanco", "PONTOS DE BANCO/CARTÃO (Livelo, Esfera, Iupp, Átomos)", false],
];

export function validarBriefing(b) {
  const faltando = CAMPOS.filter(([k, , obrig]) => obrig && !String(b?.[k] ?? "").trim())
    .map(([, rotulo]) => rotulo);
  if (faltando.length) {
    throw new Error(`Campos obrigatórios faltando: ${faltando.join(", ")}`);
  }
}

/** Monta o bloco de briefing no formato que o prompt espera. */
export function montarBriefing(b) {
  const linhas = CAMPOS.map(([k, rotulo]) => {
    const v = String(b?.[k] ?? "").trim();
    if (k === "milheiro" && !v) {
      return `${rotulo}: (não informado — pesquisar na Camada 6.0)`;
    }
    if ((k === "programas" || k === "pontosBanco") && !v) {
      return `${rotulo}: (não informado — aplicar a regra "sem saldo informado" da Camada 6.0: referência conservadora no cálculo, potencial na narrativa)`;
    }
    return `${rotulo}: ${v || "(não informado)"}`;
  });
  return linhas.join("\n");
}

export function nomeArquivo(b) {
  const limpa = (s) =>
    String(s ?? "").trim().toUpperCase().normalize("NFD")
      .replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9]/g, "").slice(0, 12) || "XXX";
  const ano = (String(b?.ida ?? "").match(/(20\d{2})/) || [])[1]
    || String(new Date().getFullYear());
  return `${limpa(b.origem)}-${limpa(b.destino)}_${ano}_ROTA_MILHAS_TANIA.html`;
}

/** Extrai o HTML da resposta, ignorando blocos de busca e tirando cercas de código. */
export function extrairHtml(message) {
  const texto = (message.content || [])
    .filter((bloco) => bloco.type === "text")
    .map((bloco) => bloco.text)
    .join("");

  const cerca = texto.match(/```(?:html)?\s*\n([\s\S]*?)```/i);
  let html = (cerca ? cerca[1] : texto).trim();

  const inicio = html.search(/<!DOCTYPE html>/i);
  if (inicio > 0) html = html.slice(inicio);
  return html;
}

/** Erros comuns que passam despercebidos. Lança se o documento sair quebrado. */
export function verificarHtml(html) {
  const problemas = [];
  if (!/^<!DOCTYPE html>/i.test(html)) problemas.push("não começa com <!DOCTYPE html>");
  if (!/<\/script>/i.test(html)) problemas.push("falta </script> — o JS seria descartado pelo browser");
  if (!/<\/html>\s*$/i.test(html)) problemas.push("não termina com </html> — resposta truncada");
  if (/cdnjs|googleapis|unpkg|jsdelivr/i.test(html)) problemas.push("carrega recurso externo (CDN) — não abre offline");
  if (/robson|onegovailonge|nomadglobal|airportpark/i.test(html)) problemas.push("sobrou afiliado de terceiro");
  for (const id of ["daySliderTrack", "milhasSliderTrack", "ciaPills", "milhasPills"]) {
    if (!html.includes(id)) problemas.push(`falta o elemento #${id}`);
  }
  return problemas;
}

/**
 * Gera o documento. `onProgresso` recebe eventos legíveis para a UI.
 */
export async function gerarDocumento(briefing, { onProgresso = () => {}, apiKey } = {}) {
  validarBriefing(briefing);

  const client = new Anthropic({ apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY });
  const promptMotor = await lerPrompt();
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  onProgresso({ fase: "pesquisando", detalhe: "Iniciando pesquisa de rotas e cotações" });

  let buscas = 0;

  const stream = client.messages.stream({
    model: "claude-opus-5",
    max_tokens: 64000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 25 }],
    // O prompt-motor é idêntico em toda geração -> vai no system, cacheado.
    // O briefing é volátil -> vai depois, na mensagem do usuário.
    system: [
      {
        type: "text",
        text: promptMotor,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content:
          `Data de hoje: ${hoje}.\n\n` +
          `Gere o documento seguindo o prompt acima à risca. ` +
          `Responda APENAS com o HTML completo, começando em <!DOCTYPE html> ` +
          `e terminando em </html>. Sem texto antes ou depois.\n\n` +
          `BRIEFING:\n${montarBriefing(briefing)}`,
      },
    ],
  });

  stream.on("contentBlock", (bloco) => {
    if (bloco.type === "server_tool_use" && bloco.name === "web_search") {
      buscas += 1;
      onProgresso({ fase: "pesquisando", detalhe: `${buscas} buscas realizadas`, buscas });
    }
  });

  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new Error(`Geração recusada pelo modelo: ${message.stop_details?.category ?? "sem categoria"}`);
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("Documento truncado — estourou max_tokens. Reduza o escopo ou aumente o limite.");
  }

  onProgresso({ fase: "montando", detalhe: "Montando o HTML" });

  const html = extrairHtml(message);
  const problemas = verificarHtml(html);

  const u = message.usage ?? {};
  const custo =
    ((u.input_tokens ?? 0) * 5 +
      (u.cache_creation_input_tokens ?? 0) * 6.25 +
      (u.cache_read_input_tokens ?? 0) * 0.5 +
      (u.output_tokens ?? 0) * 25) / 1_000_000 +
    (u.server_tool_use?.web_search_requests ?? 0) * 0.01;

  return {
    html,
    nome: nomeArquivo(briefing),
    problemas,
    uso: {
      buscas: u.server_tool_use?.web_search_requests ?? buscas,
      tokensEntrada: u.input_tokens ?? 0,
      tokensCacheLido: u.cache_read_input_tokens ?? 0,
      tokensSaida: u.output_tokens ?? 0,
      custoUSD: Number(custo.toFixed(3)),
    },
  };
}

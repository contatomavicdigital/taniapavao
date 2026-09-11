#!/usr/bin/env node
/** Testa a lógica local sem chamar a API (não custa nada). `npm test` */
import { montarBriefing, nomeArquivo, extrairHtml, verificarHtml, validarBriefing } from "../lib/gerar.mjs";

let falhas = 0;
const t = (nome, cond) => { console.log((cond ? "  ✓ " : "  ✗ ") + nome); if (!cond) falhas++; };
const base = { origem: "GRU", destino: "CDG", ida: "2027-03-14", volta: "2027-03-28", passageiros: "2", cabine: "Executiva", flexibilidade: "5" };
const puro = "<!DOCTYPE html><html><body>x</body></html>";

console.log("\n▸ validação");
try { validarBriefing({ origem: "GRU" }); t("recusa briefing incompleto", false); }
catch { t("recusa briefing incompleto", true); }
try { validarBriefing(base); t("aceita briefing mínimo (5 campos)", true); } catch { t("aceita mínimo", false); }

console.log("\n▸ nome do arquivo");
t("formato correto", nomeArquivo(base) === "GRU-CDG_2027_ROTA_MILHAS_TANIA.html");
t("acentos e espaços removidos", nomeArquivo({ ...base, origem: "São Paulo", destino: "Paris" }) === "SAOPAULO-PARIS_2027_ROTA_MILHAS_TANIA.html");

console.log("\n▸ briefing sem saldo → regra da Camada 6.0");
const txt = montarBriefing(base);
t("milheiro cai na pesquisa", txt.includes("pesquisar na Camada 6.0"));
t("saldo aciona regra conservadora", txt.includes("referência conservadora no cálculo"));
t("pontos de banco com nome claro", txt.includes("PONTOS DE BANCO/CARTÃO"));

console.log("\n▸ extração de HTML");
t("tira cerca de código", extrairHtml({ content: [{ type: "text", text: "Aqui:\n```html\n" + puro + "\n```" }] }) === puro);
t("ignora blocos de busca", extrairHtml({ content: [{ type: "web_search_tool_result", content: [] }, { type: "text", text: puro }] }) === puro);
t("corta preâmbulo solto", extrairHtml({ content: [{ type: "text", text: "Pronto!\n\n" + puro }] }) === puro);

console.log("\n▸ verificação de HTML quebrado");
t("pega </script> faltando", verificarHtml("<!DOCTYPE html><html></html>").some((p) => p.includes("script")));
t("pega CDN infiltrado", verificarHtml('<!DOCTYPE html>x<script src="https://cdnjs.com/a.js"></script></html>').some((p) => p.includes("CDN")));
t("pega afiliado de terceiro", verificarHtml("<!DOCTYPE html>ROBSON40</script></html>").some((p) => p.includes("afiliado")));
t("pega truncamento", verificarHtml("<!DOCTYPE html>x</script>").some((p) => p.includes("truncada")));
t("pega slider faltando", verificarHtml("<!DOCTYPE html>x</script></html>").some((p) => p.includes("milhasSliderTrack")));

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTudo passou.\n");
process.exit(falhas ? 1 : 0);

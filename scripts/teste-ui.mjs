import { chromium } from "playwright";
import http from "node:http";
import { readFile } from "node:fs/promises";

const SP = process.env.SP || ".";
let f = 0;
const t = (n, c) => { console.log((c ? "  ✓ " : "  ✗ ") + n); if (!c) f++; };

// Servidor local: serve o formulário e finge ser a API, encenando um job real.
let chamadas = 0;
const srv = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/api/iniciar") {
    let b = ""; req.on("data", c => b += c);
    await new Promise(r => req.on("end", r));
    globalThis.briefingRecebido = JSON.parse(b);
    res.writeHead(200, {"content-type":"application/json"});
    return res.end(JSON.stringify({ jobId: "job-teste" }));
  }
  if (u.pathname === "/api/status") {
    if (u.searchParams.get("baixar") === "1") {
      res.writeHead(200, {"content-type":"text/html"});
      return res.end("<!DOCTYPE html><html></html>");
    }
    chamadas++;
    const etapas = [
      { estado:"processando", fase:"pesquisando", detalhe:"3 buscas realizadas" },
      { estado:"processando", fase:"montando",    detalhe:"Montando o HTML" },
      { estado:"pronto", nome:"GRU-CDG_2027_ROTA_MILHAS_TANIA.html",
        problemas:["falta </script> — o JS seria descartado pelo browser"],
        uso:{ buscas:14, tokensSaida:38210, custoUSD:2.31 } },
    ];
    res.writeHead(200, {"content-type":"application/json"});
    return res.end(JSON.stringify(etapas[Math.min(chamadas-1, 2)]));
  }
  res.writeHead(200, {"content-type":"text/html; charset=utf-8"});
  res.end(await readFile(new URL("../cotacao.html", import.meta.url)));
});
await new Promise(r => srv.listen(0, r));
const base = `http://127.0.0.1:${srv.address().port}`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

for (const [rotulo, viewport] of [["desktop",{width:1280,height:900}], ["celular",{width:390,height:844}]]) {
  const page = await browser.newPage({ viewport });
  const erros = [];
  page.on("pageerror", e => erros.push(e.message));
  await page.goto(base, { waitUntil: "networkidle" });

  console.log(`\n▸ ${rotulo} (${viewport.width}px)`);
  t("carrega sem erro de JS", erros.length === 0);
  t("título certo", (await page.title()).includes("Nova cotação"));
  t("4 campos obrigatórios (volta é opcional)", await page.locator("[required]").count() === 4);
  t("perfil do cliente vem recolhido", !(await page.locator("details").first().evaluate(e => e.open)));
  t("sem scroll horizontal",
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  t(`fundo navy da IDV (${bg})`, bg === "rgb(8, 13, 26)");
  t("data de ida bloqueia passado",
    await page.locator("#ida").getAttribute("min") === new Date().toISOString().slice(0,10));

  await page.screenshot({ path: `${SP}/form-${rotulo}.png`, fullPage: true });
  await page.close();
}

// Fluxo completo
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const erros = [];
page.on("pageerror", e => erros.push(e.message));
await page.goto(base, { waitUntil: "networkidle" });

console.log("\n▸ fluxo de ponta a ponta");
await page.fill("#origem", "GRU");
await page.fill("#destino", "CDG");
await page.fill("#ida", "2027-03-14");
await page.fill("#volta", "2027-03-28");
await page.fill("#passageiros", "2");
await page.click("#btn");

await page.waitForSelector("#painel.on", { timeout: 5000 });
t("painel de progresso aparece", true);
t("botão trava durante a geração", await page.locator("#btn").isDisabled());

await page.waitForFunction(() => document.getElementById("fase").textContent.includes("Pesquisando"), { timeout: 8000 });
t("mostra fase 'Pesquisando'", true);
t("mostra detalhe das buscas", (await page.locator("#detalhe").textContent()).includes("3 buscas"));

await page.waitForSelector("#painel.ok", { timeout: 15000 });
t("chega em 'pronto'", (await page.locator("#fase").textContent()).includes("pronta"));
t("mostra nome do arquivo", (await page.locator("#detalhe").textContent()).includes("ROTA_MILHAS_TANIA"));
t("link de download presente", await page.locator("a.baixar").count() === 1);
t("avisa sobre problema detectado", (await page.locator(".problemas").textContent()).includes("</script>"));
t("mostra custo real", (await page.locator(".uso").textContent()).includes("2.31"));
t("botão reabilitado no fim", !(await page.locator("#btn").isDisabled()));
t("nenhum erro de JS no fluxo todo", erros.length === 0);

const br = globalThis.briefingRecebido;
console.log("\n▸ briefing que chegou na function");
t("campos obrigatórios", br.origem === "GRU" && br.destino === "CDG" && br.passageiros === "2");
t("cabine com padrão Executiva", br.cabine === "Executiva");
t("saldo vazio (o app não sabe)", br.programas === "" && br.pontosBanco === "");

await page.screenshot({ path: `${SP}/form-pronto.png`, fullPage: true });
await browser.close();
srv.close();

console.log(f ? `\n${f} FALHA(S)\n` : "\nFormulário e fluxo OK.\n");
process.exit(f ? 1 : 0);

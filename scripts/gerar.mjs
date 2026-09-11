#!/usr/bin/env node
/**
 * Gera uma cotação pela linha de comando.
 * Serve como plano B: não depende da Netlify, do plano da conta nem de deploy.
 *
 *   ANTHROPIC_API_KEY=sk-... npm run gerar -- --origem GRU --destino CDG \
 *     --ida 2027-03-14 --volta 2027-03-28 --passageiros 2
 */
import { writeFile } from "node:fs/promises";
import { gerarDocumento } from "../lib/gerar.mjs";

const args = process.argv.slice(2);
const briefing = {};
for (let i = 0; i < args.length; i += 2) {
  if (args[i]?.startsWith("--")) briefing[args[i].slice(2)] = args[i + 1] ?? "";
}
briefing.cabine ||= "Executiva";
briefing.flexibilidade ||= "5";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Falta ANTHROPIC_API_KEY no ambiente.");
  process.exit(1);
}

const inicio = Date.now();
try {
  const r = await gerarDocumento(briefing, {
    onProgresso: ({ detalhe }) => process.stdout.write(`\r  ${detalhe.padEnd(60)}`),
  });

  await writeFile(r.nome, r.html, "utf-8");
  const min = ((Date.now() - inicio) / 60000).toFixed(1);

  console.log(`\n\n✓ ${r.nome}`);
  console.log(`  ${min} min · ${r.uso.buscas} buscas · US$ ${r.uso.custoUSD.toFixed(2)}`);
  console.log(`  cache: ${r.uso.tokensCacheLido.toLocaleString("pt-BR")} tokens lidos`);

  if (r.problemas.length) {
    console.log(`\n⚠ Verificar antes de enviar:`);
    for (const p of r.problemas) console.log(`  • ${p}`);
    process.exitCode = 2;
  }
} catch (erro) {
  console.error(`\n✗ ${erro.message}`);
  process.exit(1);
}

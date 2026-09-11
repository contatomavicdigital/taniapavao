import { getStore } from "@netlify/blobs";
import { gerarDocumento } from "../../lib/gerar.mjs";

/**
 * Background function: até 15 min de execução. Responde 202 na hora e
 * segue trabalhando. O resultado vai para o Blobs, lido pelo /api/status.
 *
 * Uma geração leva vários minutos (25 buscas + documento longo), então
 * uma function síncrona (limite de 26s) daria timeout em 100% das vezes.
 */
export default async (req) => {
  const { jobId, briefing } = await req.json();
  const store = getStore("cotacoes");

  const gravar = (dados) =>
    store.setJSON(jobId, { atualizadoEm: new Date().toISOString(), ...dados });

  await gravar({ estado: "processando", fase: "iniciando", detalhe: "Preparando pesquisa" });

  try {
    const resultado = await gerarDocumento(briefing, {
      onProgresso: ({ fase, detalhe, buscas }) => {
        // Sem await: progresso não pode segurar a geração.
        gravar({ estado: "processando", fase, detalhe, buscas }).catch(() => {});
      },
    });

    await store.set(`${jobId}.html`, resultado.html, {
      metadata: { nome: resultado.nome },
    });

    await gravar({
      estado: "pronto",
      nome: resultado.nome,
      problemas: resultado.problemas,
      uso: resultado.uso,
    });
  } catch (erro) {
    await gravar({ estado: "erro", mensagem: erro?.message ?? String(erro) });
  }
};

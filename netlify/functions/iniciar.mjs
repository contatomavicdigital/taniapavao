import { validarBriefing } from "../../lib/gerar.mjs";

/**
 * Recebe o briefing, dispara a background function e devolve o jobId.
 * Retorna em milissegundos — quem demora é a background.
 */
export default async (req, context) => {
  if (req.method !== "POST") {
    return Response.json({ erro: "use POST" }, { status: 405 });
  }

  let briefing;
  try {
    briefing = await req.json();
    validarBriefing(briefing);
  } catch (erro) {
    return Response.json({ erro: erro?.message ?? "briefing inválido" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { erro: "ANTHROPIC_API_KEY não configurada nas variáveis de ambiente da Netlify" },
      { status: 500 },
    );
  }

  const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Dispara sem esperar: background functions respondem 202 imediatamente.
  await fetch(new URL("/.netlify/functions/gerar-background", req.url), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId, briefing }),
  });

  return Response.json({ jobId });
};

export const config = { path: "/api/iniciar" };

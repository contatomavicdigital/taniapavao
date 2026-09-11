import { getStore } from "@netlify/blobs";

/** Estado do job e, quando pronto, o HTML gerado. */
export default async (req) => {
  const url = new URL(req.url);
  const jobId = url.searchParams.get("job");
  const baixar = url.searchParams.get("baixar") === "1";

  if (!jobId) {
    return Response.json({ erro: "informe ?job=" }, { status: 400 });
  }

  const store = getStore("cotacoes");

  if (baixar) {
    const html = await store.get(`${jobId}.html`);
    if (!html) return new Response("ainda não pronto", { status: 404 });
    const estado = (await store.get(jobId, { type: "json" })) ?? {};
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-disposition": `attachment; filename="${estado.nome ?? "cotacao.html"}"`,
      },
    });
  }

  const estado = await store.get(jobId, { type: "json" });
  if (!estado) return Response.json({ estado: "desconhecido" }, { status: 404 });
  return Response.json(estado, { headers: { "cache-control": "no-store" } });
};

export const config = { path: "/api/status" };

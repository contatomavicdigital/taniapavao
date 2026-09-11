# Checklist de QA — documento de rota gerado

Rodar a cada documento, antes de mandar pro cliente. Ordem proposital:
o que quebra silenciosamente vem primeiro.

## 🔴 Quebra silenciosa — testar SEMPRE

- [ ] **Abrir no iPhone** (AirDrop / WhatsApp / anexo de e-mail — o QuickLook).
      É onde quebra. No desktop tudo parece funcionar mesmo com o JS morto.
- [ ] **Slider de companhias:** botões ← → andam? Os dots acompanham? Swipe funciona?
- [ ] **Slider de programas:** idem, e — o teste crítico — as pills de companhia
      **não** podem mexer no slider de milhas, e vice-versa. Se mexerem, os
      containers de pills estão sem `id` ou com o `id` trocado.
- [ ] **Contagem de cards:** clicar "próximo" até travar. O último card tem que ser
      o último de verdade. Se travar antes, ou se der pra passar do fim,
      `N_CIAS` / `N_PROGRAMAS` estão errados no JS.
- [ ] **`</script>` presente** antes do `</body>`. Sem ela o browser descarta
      o JS inteiro sem avisar — sintoma: nada clica.

## 💎 Números — o que destrói a credibilidade

- [ ] **Milheiro declarado tem valor + via + data?**
      "R$ 17,40 · via transferência Livelo→Smiles 100% · pesquisado em DD/MM"
      Só o valor não serve.
- [ ] **A via escolhida é acessível ao cliente?** Se a referência é transferência
      bonificada, o briefing informou pontos no Livelo/Esfera? Se não, o número
      é fantasia — refazer.
- [ ] **Refazer o VEM na mão** em pelo menos 1 programa:
      `(preço em dinheiro − taxas) ÷ (milhas ÷ 1.000)`
      Bateu com o que está no `.vem-box`?
- [ ] **Coerência entre seções:** o preço da Seção 1 é o mesmo da Seção 2,
      da Seção 3 e da tabela da Camada 4? Divergiu em qualquer ponto, refazer.
- [ ] **Escada das 4 vias** aparece (marketplace, compra direta, transferência,
      clube) — não só o número escolhido.
- [ ] **Toda tabela de milhas** tem `⚠️ cotação sujeita a variação`.
- [ ] **Todo preço** tem fonte: `✅ pesquisado em [data]` ou `⚠️ estimativa histórica`.
      Número sem fonte não pode estar no documento.

## 🎯 Posicionamento — o erro mais fácil de cometer

- [ ] Procurar no texto por **"barato"**, **"economizar"**, **"promoção"**.
      Se aparecer como argumento central, está fora da marca dela.
- [ ] **Executiva é a cabine protagonista?** Econômica só como comparação.
- [ ] **Ultra low cost** só aparece se for a única rota possível — e marcada
      como fora do padrão.
- [ ] **Bloco "Salto de Cabine"** presente e com os dois números.

## 🔗 Links e assinatura

- [ ] Abrir **3 links ao acaso** de companhia/programa. Algum 404 ou inventado?
- [ ] Rodapé é **@passosdopavaomilhas · Tania Pavão**?
- [ ] Sobrou algum afiliado de terceiro? Procurar por **ROBSON40**,
      **robsonjesus**, **onegovailonge**, **nomadglobal**, **airportpark**.
      Qualquer ocorrência = remover.
- [ ] CTA da sessão no fim da Seção 3, com o link certo.

## 📱 Estrutura

- [ ] 8 seções, na ordem, e o índice com 8 links que funcionam.
- [ ] Cards de faixa de preço **empilham** no celular (não espremem em 3 colunas).
- [ ] Dois calendários (IDA e VOLTA), ambos com R$ **e** milhas.
- [ ] "Voltar ao topo" funciona em todas as seções.
- [ ] Abre **offline** (modo avião). Se quebrar, entrou CDN ou fonte externa.

## Comando rápido de verificação

```bash
grep -icE "robson|onegovailonge|nomadglobal|airportpark" arquivo.html   # tem que dar 0
grep -c "</script>" arquivo.html                                        # tem que dar 1
grep -oE "N_CIAS|totalSlides|total: [0-9]+" arquivo.html                # conferir contagem
grep -icE "cdn|googleapis|unpkg|jsdelivr" arquivo.html                  # tem que dar 0
```

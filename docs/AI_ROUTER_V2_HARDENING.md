# AI Router v2 — hardening pré-commit

## Caminho da mensagem e fronteiras de privacidade

1. O componente recebe o texto digitado e executa somente uma detecção complementar de PII explícita.
2. Mensagens sem PII são exibidas e persistidas no `sessionStorage` antes da requisição. Mensagens com PII não criam uma mensagem de usuário persistida.
3. `buildAssistantChatRequest` envia à rota o texto original, sem redação silenciosa. O navegador não é a autoridade de segurança.
4. A rota valida o contrato e aplica rate limit antes de chamar `runAssistantChat`.
5. `runAssistantChat` aplica o privacy guard ao texto original antes do Router, classificador ou Maya. Ao detectar PII, responde de forma determinística e pode anexar somente uma action de contato resolvida pelo servidor a partir dos dados públicos do hotel.
6. Sem PII, somente mensagens operacionais conservadoras de até 600 caracteres podem chegar ao classificador. O classificador recebe o texto original, sem `pageData`, histórico, hotel, URL ou identificadores e usa um UUID v4 efêmero diferente do `contextId` do hóspede.
7. Quando o Router decide por IA completa, a Maya recebe o texto original e um contexto separado formado exclusivamente pelos dados públicos do LibGuest.
8. Respostas da Maya têm URLs removidas server-side. Actions e CTAs são sempre server-owned.

Uma chamada direta à API não contorna o privacy guard porque a decisão fail-closed está em `runAssistantChat`, depois da validação da rota e antes de qualquer cliente GPTMaker. Não há log de mensagem, resposta ou PII nesse caminho.

## Agentes GPTMaker

- `GPTMAKER_AGENT_ID`: agente Maya, com o contexto público do hotel.
- `GPTMAKER_CLASSIFIER_AGENT_ID`: agente técnico dedicado ao classificador.
- `GPTMAKER_API_KEY`: credencial server-side compartilhada pelo transporte.

O classificador é desabilitado quando seu ID está ausente, inválido ou é igual ao ID da Maya. Nesse caso a mensagem segue diretamente para a Maya, sem usar a Maya como classificador e sem expor erro de configuração.

O agente classificador deve ter:

- nenhuma base do hotel ou treinamento operacional;
- nenhuma personalidade;
- nenhuma tool, webhook, MCP ou integração;
- somente a instrução necessária para retornar o JSON fechado do classificador.

Esta etapa não cria nem altera agentes remotamente.

## AssistantUsageTrace

O resultado interno de cada mensagem contém apenas:

```ts
type AssistantUsageTrace = {
  resolutionPath:
    | 'deterministic'
    | 'direct_ai'
    | 'classifier_to_capability'
    | 'classifier_to_ai'
    | 'classifier_failed_to_ai';
  classifierCalls: 0 | 1;
  fullAiCalls: 0 | 1;
  totalUpstreamCalls: 0 | 1 | 2;
};
```

O trace não é enviado no JSON público, não é persistido no `sessionStorage`, não entra em analytics e não é registrado com conteúdo. Ele relata somente quantidade e tipo de chamada; não pressupõe custo relativo entre agentes.

Cada mensagem realiza no máximo uma chamada de classificação e uma chamada à Maya. Escape de clarificação apenas reentra no Router localmente. Turismo não faz verificação por outro modelo nem reescrita automática.

## Turismo

- `libguest_curated`: conteúdo público explicitamente cadastrado, inclusive restaurante interno do hotel.
- `general_ai`: usado somente quando a resposta final sanitizada contém uma sugestão geral real. Recebe ressalva de que não é indicação oficial e orientação para confirmação em canais oficiais.
- `unavailable`: ausência de catálogo e de sugestão concreta, recusa do modelo, lista vazia, mero encaminhamento ou remoção de alegações operacionais não confirmadas.

Preço, horário, distância, parceria, funcionamento e disponibilidade externos não cadastrados não são apresentados como confirmados. URLs do modelo são removidas e nenhuma action nasce do GPTMaker. A origem turística permanece apenas no resultado interno em memória nesta etapa.

## Política de thresholds

`HIGH=0.90` e `MEDIUM=0.70` são thresholds de política. A confiança é declarada pelo modelo e não representa probabilidade calibrada. É necessária avaliação própria antes de qualquer uso transacional real. Nenhuma classificação executa n8n, MCP ou operação externa nesta etapa.

## Risco externo e checklist de retenção

Uma chamada `conversation` com UUID efêmero pode criar um chat remoto. A retenção depende do GPTMaker e não há exclusão automática implementada.

Checklist manual:

1. Executar uma classificação.
2. Abrir **Chats** no agente classificador.
3. Verificar se foi criado um registro.
4. Observar como o registro é identificado.
5. Verificar as opções de retenção e exclusão disponíveis.
6. Não automatizar a exclusão nesta etapa.

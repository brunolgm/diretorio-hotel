const GPTMAKER_AGENT_ID_PATTERN = /^[A-F0-9]{32}$/i;

export function resolveDedicatedClassifierAgentId({
  mayaAgentId,
  classifierAgentId,
}: {
  mayaAgentId: string | null | undefined;
  classifierAgentId: string | null | undefined;
}) {
  const maya = (mayaAgentId ?? '').trim();
  const classifier = (classifierAgentId ?? '').trim();
  if (
    !GPTMAKER_AGENT_ID_PATTERN.test(maya) ||
    !GPTMAKER_AGENT_ID_PATTERN.test(classifier) ||
    classifier.toUpperCase() === maya.toUpperCase()
  ) return null;
  return classifier;
}

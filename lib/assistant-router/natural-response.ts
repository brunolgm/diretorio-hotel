function stableIndex(seed: string, size: number) {
  let hash = 0;
  for (const character of seed) hash = ((hash * 31) + (character.codePointAt(0) ?? 0)) >>> 0;
  return hash % size;
}

export function selectDeterministicResponse(
  approvedResponses: readonly [string, ...string[]],
  seed: string
) {
  return approvedResponses[stableIndex(seed, approvedResponses.length)];
}

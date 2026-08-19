import { Fragment, type ReactNode } from 'react';
import {
  getComposedExperienceBlockKeys,
  type ExperienceBlockKey,
  type ExperienceLayoutBlock,
} from '@/lib/experience-layout';

export function ExperienceBlockComposer({
  layout,
  blocks,
}: {
  layout: ExperienceLayoutBlock[];
  blocks: Partial<Record<ExperienceBlockKey, ReactNode>>;
}) {
  const blockKeys = getComposedExperienceBlockKeys(layout, new Set(Object.keys(blocks) as ExperienceBlockKey[]));
  return blockKeys.map((blockKey) => {
    return <Fragment key={blockKey}>{blocks[blockKey]}</Fragment>;
  });
}

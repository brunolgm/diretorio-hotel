export type ThemedCardGridMobileColumns = 2 | 3;
export type ThemedCardGridDesktopBreakpoint = 'md' | 'xl';

const DESKTOP_ROWS: Record<number, readonly number[]> = {
  1: [1],
  2: [2],
  3: [3],
  4: [2, 2],
  5: [3, 2],
  6: [3, 3],
};

const DESKTOP_CONTAINER_CLASSES: Record<ThemedCardGridDesktopBreakpoint, Record<number, string>> = {
  md: {
    1: 'md:grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-2',
    5: 'md:grid-cols-6',
    6: 'md:grid-cols-3',
  },
  xl: {
    1: 'xl:grid-cols-1',
    2: 'xl:grid-cols-2',
    3: 'xl:grid-cols-3',
    4: 'xl:grid-cols-2',
    5: 'xl:grid-cols-6',
    6: 'xl:grid-cols-3',
  },
};

const MOBILE_CONTAINER_CLASSES: Record<ThemedCardGridMobileColumns, Record<number, string>> = {
  2: {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-4',
    4: 'grid-cols-2',
    5: 'grid-cols-4',
    6: 'grid-cols-2',
  },
  3: {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-2',
    5: 'grid-cols-6',
    6: 'grid-cols-3',
  },
};

function assertSupportedCardCount(cardCount: number) {
  if (!Number.isInteger(cardCount) || cardCount < 1 || cardCount > 6) {
    throw new RangeError('themed_card_grid_count_invalid');
  }
}

export function getThemedCardGridLayout(
  cardCount: number,
  mobileColumns: ThemedCardGridMobileColumns,
  desktopBreakpoint: ThemedCardGridDesktopBreakpoint = 'md'
) {
  assertSupportedCardCount(cardCount);

  return {
    desktopRows: DESKTOP_ROWS[cardCount],
    containerClassName: `${MOBILE_CONTAINER_CLASSES[mobileColumns][cardCount]} ${DESKTOP_CONTAINER_CLASSES[desktopBreakpoint][cardCount]}`,
    singleCard: cardCount === 1,
    itemClassName(index: number) {
      const mobileTwoColumnOdd = mobileColumns === 2 && (cardCount === 3 || cardCount === 5);
      const mobileThreeColumnFive = mobileColumns === 3 && cardCount === 5;
      const mobileClass = mobileTwoColumnOdd
        ? `col-span-2 ${index === cardCount - 1 ? 'col-start-2' : ''}`
        : mobileThreeColumnFive
          ? `col-span-2 ${index === 3 ? 'col-start-2' : index === 4 ? 'col-start-4' : ''}`
          : '';
      const desktopClass = desktopBreakpoint === 'md'
        ? cardCount === 5
          ? `md:col-span-2 ${index === 3 ? 'md:col-start-2' : index === 4 ? 'md:col-start-4' : 'md:col-start-auto'}`
          : mobileTwoColumnOdd
            ? 'md:col-span-1 md:col-start-auto'
            : ''
        : cardCount === 5
          ? `xl:col-span-2 ${index === 3 ? 'xl:col-start-2' : index === 4 ? 'xl:col-start-4' : 'xl:col-start-auto'}`
          : mobileTwoColumnOdd
            ? 'xl:col-span-1 xl:col-start-auto'
            : '';

      return `${mobileClass} ${desktopClass}`.trim();
    },
  };
}

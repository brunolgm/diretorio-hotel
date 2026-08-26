export interface PublicFlightCenterActionGridLayout {
  containerClassName: string;
  itemClassNames: string[];
}

export function getPublicFlightCenterActionGridLayout(
  itemCount: number
): PublicFlightCenterActionGridLayout | null {
  if (itemCount === 0) return null;
  if (itemCount < 0 || itemCount > 4) {
    throw new Error('public_flight_center_action_count_invalid');
  }

  if (itemCount === 1) {
    return {
      containerClassName: 'grid grid-cols-1 gap-3 mx-auto max-w-sm',
      itemClassNames: [''],
    };
  }

  if (itemCount === 2) {
    return {
      containerClassName: 'grid grid-cols-2 gap-3',
      itemClassNames: ['', ''],
    };
  }

  if (itemCount === 3) {
    return {
      containerClassName: 'grid grid-cols-4 gap-3 md:grid-cols-3',
      itemClassNames: [
        'col-span-2 md:col-span-1',
        'col-span-2 md:col-span-1',
        'col-span-2 col-start-2 md:col-span-1 md:col-start-auto',
      ],
    };
  }

  return {
    containerClassName: 'grid grid-cols-2 gap-3 md:grid-cols-4',
    itemClassNames: ['', '', '', ''],
  };
}

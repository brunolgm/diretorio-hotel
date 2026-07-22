type HotelPublicIdentityInput = {
  themePreset: string | null | undefined;
  operationalName: string;
};

type HotelPublicIdentityOverride = HotelPublicIdentityInput & {
  displayName: string;
};

const HOTEL_PUBLIC_IDENTITY_OVERRIDES: readonly HotelPublicIdentityOverride[] = [
  {
    themePreset: 'novotel',
    operationalName: 'Novotel Salvador',
    displayName: 'SALVADOR RIO VERMELHO',
  },
];

function normalizeIdentityValue(value: string | null | undefined) {
  return (value || '').trim().toLocaleLowerCase('pt-BR');
}

export function getHotelPublicDisplayName({
  themePreset,
  operationalName,
}: HotelPublicIdentityInput) {
  const normalizedPreset = normalizeIdentityValue(themePreset);
  const normalizedName = normalizeIdentityValue(operationalName);
  const configuredIdentity = HOTEL_PUBLIC_IDENTITY_OVERRIDES.find(
    (identity) =>
      normalizeIdentityValue(identity.themePreset) === normalizedPreset &&
      normalizeIdentityValue(identity.operationalName) === normalizedName
  );

  return configuredIdentity?.displayName || operationalName.trim();
}

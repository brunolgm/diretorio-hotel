export type CommercialItem = { id: string; name: string; menu_id: string; amount_minor: number };
export type CommercialSlot = { name: string; choices: string[] };
export type CommercialOption = { name: string; amount_minor: number };
type Draft = { id: string; name: string; revision: number; active: boolean };
export type ComboDraft = Draft & { menu_id: string; amount_minor: number; slots: CommercialSlot[] };
export type ModifierDraft = Draft & { item_id: string; max_selected: number; options: CommercialOption[] };
export type RoomCommercial = {
  menus: { id: string; name: string }[];
  items: CommercialItem[];
  combos: ComboDraft[];
  groups: ModifierDraft[];
};
export type CommercialActionState = { error?: string };

import type { useCases } from "./inquirySchema";

export type UseCase = (typeof useCases)[number];
export type CatalogItem = { name: string; aliases: string };

export const deviceCatalog: Record<UseCase, CatalogItem[]> = {
  home: [
    { name: "Lights", aliases: "bulbs lighting" },
    { name: "Fridge", aliases: "refrigerator" },
    { name: "Freezer", aliases: "deep freezer" },
    { name: "TV", aliases: "television" },
    { name: "Wi-Fi router", aliases: "internet" },
    { name: "Phone charging", aliases: "phones" },
    { name: "Laptop", aliases: "computer" },
    { name: "Washing machine", aliases: "washer" },
    { name: "Water pump", aliases: "borehole pump" },
    { name: "Microwave", aliases: "oven" },
    { name: "Electric cooker", aliases: "stove" },
    { name: "Air conditioner", aliases: "ac" },
    { name: "CCTV cameras", aliases: "security" },
  ],
  office: [
    { name: "Lights", aliases: "lighting" },
    { name: "Desktop computers", aliases: "pc" },
    { name: "Laptops", aliases: "notebooks" },
    { name: "Wi-Fi router", aliases: "internet" },
    { name: "Printer", aliases: "printing" },
    { name: "Photocopier", aliases: "copier" },
    { name: "Server equipment", aliases: "server" },
    { name: "Air conditioner", aliases: "ac" },
    { name: "CCTV cameras", aliases: "security" },
    { name: "POS system", aliases: "till" },
    { name: "Fridge", aliases: "refrigerator" },
  ],
  farm: [
    { name: "Water pump", aliases: "borehole pump" },
    { name: "Irrigation pump", aliases: "irrigation" },
    { name: "Lights", aliases: "lighting" },
    { name: "Electric fence", aliases: "fencing" },
    { name: "CCTV cameras", aliases: "security" },
    { name: "Cold room", aliases: "cold storage" },
    { name: "Freezer", aliases: "deep freezer" },
    { name: "Milking machine", aliases: "dairy" },
    { name: "Poultry equipment", aliases: "incubator" },
    { name: "Wi-Fi router", aliases: "internet" },
  ],
};

export const equipmentCatalog: CatalogItem[] = [
  { name: "Solar panels", aliases: "pv modules" },
  { name: "Solar battery", aliases: "lithium battery storage" },
  { name: "Inverter", aliases: "hybrid inverter backup" },
  { name: "Charge controller", aliases: "mppt pwm" },
  { name: "Solar water heater", aliases: "hot water" },
  { name: "Solar water pump", aliases: "borehole pump" },
  { name: "Solar lighting kit", aliases: "lights" },
  { name: "Solar TV kit", aliases: "television" },
  { name: "Mounting and cables", aliases: "brackets wiring" },
];

export function findCatalogItems(catalog: CatalogItem[], query: string, selected: string[]): CatalogItem[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  return catalog.filter(({ name, aliases }) =>
    !selected.some((item) => item.toLocaleLowerCase() === name.toLocaleLowerCase()) &&
    `${name} ${aliases}`.toLocaleLowerCase().includes(normalized)
  ).slice(0, 6);
}

import r1 from "@/assets/r1.jpg";
import r2 from "@/assets/r2.jpg";
import r3 from "@/assets/r3.jpg";
import r4 from "@/assets/r4.jpg";

export type Option = { name: string; price: number };
export type Dish = {
  id: string; name: string; desc: string; price: number; veg: boolean;
  category: string; available: boolean; image?: string;
  sizes?: Option[]; extras?: Option[]; spicy?: boolean;
};
// "Restaurant" = partner tobacco shop; "Dish" = cigarette product. veg=true marks menthol.
export type Restaurant = {
  id: string; name: string; cuisines: string[]; rating: number; eta: number;
  fee: number; costForTwo: number; offer?: string; image: string; open: boolean;
  hours: string; minOrder: number; area: string; pureVeg?: boolean;
  menu: Dish[];
};

const packs = [{ name: "Pack of 10", price: 0 }, { name: "Pack of 20", price: 0 }, { name: "Carton (10 packs)", price: 0 }];
const priced = (p10: number): Option[] => [
  { name: packs[0]!.name, price: 0 }, { name: packs[1]!.name, price: p10 }, { name: packs[2]!.name, price: p10 * 9 },
];
const add = [{ name: "Matchbox", price: 2 }, { name: "Lighter", price: 20 }];

const products: Dish[] = [
  { id: "rk", name: "Red Crest Kings", desc: "Full flavour, 84mm, filter.", price: 180, veg: false, category: "Kings", available: true, image: r2, sizes: priced(180), extras: add },
  { id: "gs", name: "Golden Stag Regular", desc: "Classic blend, 69mm.", price: 110, veg: false, category: "Regular", available: true, image: r1, sizes: priced(110), extras: add },
  { id: "nm", name: "Nova Mint", desc: "Menthol capsule, 84mm.", price: 190, veg: true, category: "Menthol", available: true, image: r3, sizes: priced(190), extras: add },
  { id: "ic", name: "Ice Cove Double Click", desc: "Two menthol capsules.", price: 210, veg: true, category: "Menthol", available: true, image: r3, sizes: priced(210), extras: add },
  { id: "fr", name: "Frost Regular", desc: "Cool menthol, 69mm.", price: 120, veg: true, category: "Regular", available: true, image: r3, sizes: priced(120), extras: add },
  { id: "sl", name: "Silver Leaf Lights", desc: "Mild, smooth draw.", price: 165, veg: false, category: "Lights", available: true, image: r2, sizes: priced(165), extras: add },
  { id: "ns", name: "Noir Slims Gold", desc: "Premium slim, 100mm.", price: 320, veg: false, category: "Slims", available: true, image: r4, sizes: priced(320), extras: add },
  { id: "nb", name: "Noir Black Kings", desc: "Rich, full-bodied.", price: 290, veg: false, category: "Kings", available: true, image: r4, sizes: priced(290), extras: add },
  { id: "bl", name: "Blue Line Lights", desc: "Smooth, lighter blend.", price: 170, veg: false, category: "Lights", available: false, image: r2 },
];

// Single Kash store; no shop selection in the UI.
export const store: Restaurant = { id: "kash", name: "Kash Store", cuisines: ["Cigarettes"], rating: 4.6, eta: 20, fee: 19, costForTwo: 0, image: r1, open: true, hours: "8am – 12am", minOrder: 99, area: "Bengaluru", menu: products };
export const storeCoords: [number, number] = [12.9719, 77.6412];
export const restaurants: Restaurant[] = [store];

export const categories = [
  { name: "Kings", image: r2 }, { name: "Menthol", image: r3 },
  { name: "Slims", image: r4 }, { name: "Lights", image: r1 },
];

export const coupons: Record<string, { pct: number; max: number; min: number }> = {
  KASH10: { pct: 10, max: 100, min: 149 },
  FIRST20: { pct: 20, max: 150, min: 0 },
};

export const getRestaurant = (id: string) => restaurants.find((r) => r.id === id);

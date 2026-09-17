export type ChecklistSection = { title: string; items: string[] };
export type ChecklistTemplate = { revision: number; common: ChecklistSection[]; daon: ChecklistSection[] };
export const CHECKLIST_KEY = 'dreamhouse_checkin_checklist_v1';
export const DEFAULT_CHECKLIST: ChecklistTemplate = {
  revision: 0,
  common: [
    { title: 'Appliances and electronics', items: [
      'Microwave', 'Gas range', 'Refrigerator', 'Water dispenser', 'Electric kettle', 'Coffee maker',
      'Washing machine', 'Hair dryer', 'Electric fan', 'Ceiling fan', 'Air conditioner filter',
      'TV and streaming apps work; previous accounts signed out', 'Remote controls work', 'Door lock batteries'
    ] },
    { title: 'Kitchen and dining', items: [
      'Dish organizer', 'Plates', 'Spoons', 'Chopsticks', 'Ladle set', 'Plastic drinking glasses',
      'Small pot (hand pot)', 'Cooking pots', 'Frying pan', 'Knives', 'Scissors', 'Can opener',
      'Peeler', 'Chopping board', 'Pot holders', 'Kitchen tongs', 'Dining table'
    ] },
    { title: 'Bathroom', items: [
      'Toilet bowl', 'Toilet faucet and washbasin faucet', 'Bathroom mirror', 'Shower heads',
      'Shower hose', 'Shower set', 'Water heater', 'Towels', 'Towel organizer', 'Bathroom slippers'
    ] },
    { title: 'Bedrooms and living areas', items: [
      'Mattresses and pillows', 'Blankets, quilts and bed linen', 'Bed setup matches the guest requirements',
      'Hangers', 'Curtains', 'Sofa and sofa covers', 'Shoe organizer', 'Step stool'
    ] },
    { title: 'House and safety', items: [
      'Front of house', 'Back of house', 'Window screens', 'All window tracks lubricated',
      'Stair stoppers', 'Door seals / stoppers to keep cockroaches out'
    ] },
    { title: 'Welcome pack and guest setup', items: [
      'Plastic food containers', 'Dishwashing sponge / scrubber', 'Dishwashing detergent',
      'Rubbing alcohol', 'Mangoes', 'Guest guidebook', 'SIM card setup'
    ] }
  ],
  daon: [{ title: 'Daon Mom extra welcome pack', items: ['Mango jelly', 'Cup noodles', 'Cup noodles for children'] }]
};

export function validateChecklist(value: unknown): ChecklistTemplate | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as ChecklistTemplate;
  if (!Number.isSafeInteger(v.revision) || v.revision < 0) return null;
  const valid = (sections: unknown): sections is ChecklistSection[] => Array.isArray(sections) && sections.length > 0 && sections.length <= 12 && sections.every(s =>
    s && typeof s.title === 'string' && s.title.trim().length > 0 && s.title.length <= 80 &&
    Array.isArray(s.items) && s.items.length > 0 && s.items.length <= 50 && s.items.every((x: unknown) => typeof x === 'string' && x.trim().length > 0 && x.length <= 180));
  if (!valid(v.common) || !valid(v.daon) || [...v.common, ...v.daon].reduce((n,s) => n+s.items.length,0) > 180) return null;
  return {revision:v.revision,common:v.common.map(s=>({title:s.title.trim(),items:s.items.map(x=>x.trim())})),daon:v.daon.map(s=>({title:s.title.trim(),items:s.items.map(x=>x.trim())}))};
}

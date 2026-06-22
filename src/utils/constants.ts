export type SeedCategory = {
  name: string;
  parent: string;
};

export const SEED_CATEGORIES: SeedCategory[] = [
  // Personal
  { name: 'Gym', parent: 'Personal' },
  { name: 'Entertainment', parent: 'Personal' },
  { name: 'Shopping', parent: 'Personal' },
  { name: 'Health', parent: 'Personal' },
  { name: 'Education', parent: 'Personal' },
  // Household
  { name: 'Grocery', parent: 'Household' },
  { name: 'Electricity', parent: 'Household' },
  { name: 'Water', parent: 'Household' },
  { name: 'Gas', parent: 'Household' },
  { name: 'Rent', parent: 'Household' },
  { name: 'Maintenance', parent: 'Household' },
  // Transport
  { name: 'Auto', parent: 'Transport' },
  { name: 'Bus', parent: 'Transport' },
  { name: 'Fuel', parent: 'Transport' },
  { name: 'Parking', parent: 'Transport' },
  // Food
  { name: 'Restaurant', parent: 'Food' },
  { name: 'Snacks', parent: 'Food' },
  { name: 'Tea/Coffee', parent: 'Food' },
  // Bills
  { name: 'Mobile', parent: 'Bills' },
  { name: 'Internet', parent: 'Bills' },
  { name: 'Insurance', parent: 'Bills' },
  { name: 'Subscriptions', parent: 'Bills' },
  // Other
  { name: 'Other', parent: 'Other' },
];

export const DB_NAME = 'voicekhata.db';

export const CATEGORY_PARENTS = [
  'Personal',
  'Household',
  'Transport',
  'Food',
  'Bills',
  'Other',
] as const;

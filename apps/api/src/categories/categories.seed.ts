type DefaultCategory = {
  name: string;
  slug: string;
  description: string;
  parentSlug?: string;
  sortOrder?: number;
  schemaDefinition?: {
    fields: Array<{
      key: string;
      label?: string;
      type: 'text' | 'number' | 'select' | 'toggle';
      options?: string[];
      required?: boolean;
      placeholder?: string;
    }>;
  };
};

export const defaultCategories: DefaultCategory[] = [
  {
    name: 'Motors',
    slug: 'motors',
    description: 'Cars, bikes, spare parts, and dealer inventory.',
    sortOrder: 10,
  },
  {
    name: 'Cars',
    slug: 'cars',
    parentSlug: 'motors',
    description: 'Used and new cars from private sellers and dealers.',
    sortOrder: 11,
    schemaDefinition: {
      fields: [
        { key: 'make', label: 'Make', type: 'text', required: true },
        { key: 'model', label: 'Model', type: 'text', required: true },
        { key: 'year', label: 'Year', type: 'number', required: true },
        { key: 'mileage', label: 'Mileage', type: 'number' },
        {
          key: 'condition',
          label: 'Condition',
          type: 'select',
          options: ['New', 'Like new', 'Used'],
        },
      ],
    },
  },
  {
    name: 'Property',
    slug: 'property',
    description: 'Apartments, villas, offices, and land.',
    sortOrder: 20,
  },
  {
    name: 'Apartments',
    slug: 'apartments',
    parentSlug: 'property',
    description: 'Apartments for rent or sale.',
    sortOrder: 21,
    schemaDefinition: {
      fields: [
        {
          key: 'propertyType',
          label: 'Property type',
          type: 'select',
          options: ['Apartment', 'Villa', 'Office', 'Land'],
          required: true,
        },
        { key: 'bedrooms', label: 'Bedrooms', type: 'number' },
        { key: 'bathrooms', label: 'Bathrooms', type: 'number' },
        { key: 'area', label: 'Area', type: 'number', placeholder: '1200 sqft' },
        { key: 'furnished', label: 'Furnished', type: 'toggle' },
      ],
    },
  },
  {
    name: 'Electronics',
    slug: 'electronics',
    description: 'Phones, laptops, consoles, and accessories.',
    sortOrder: 30,
    schemaDefinition: {
      fields: [
        { key: 'brand', label: 'Brand', type: 'text', required: true },
        { key: 'model', label: 'Model', type: 'text' },
        { key: 'storage', label: 'Storage', type: 'text' },
        {
          key: 'condition',
          label: 'Condition',
          type: 'select',
          options: ['New', 'Like new', 'Used'],
        },
        { key: 'warranty', label: 'Warranty available', type: 'toggle' },
      ],
    },
  },
  {
    name: 'Jobs',
    slug: 'jobs',
    description: 'Hiring, freelance gigs, and business opportunities.',
    sortOrder: 40,
    schemaDefinition: {
      fields: [
        {
          key: 'jobType',
          label: 'Job type',
          type: 'select',
          options: ['Full-time', 'Part-time', 'Contract'],
        },
        {
          key: 'experience',
          label: 'Experience level',
          type: 'select',
          options: ['Entry', 'Mid', 'Senior'],
        },
        { key: 'salary', label: 'Monthly salary', type: 'number' },
      ],
    },
  },
  {
    name: 'Services',
    slug: 'services',
    description: 'Repair, maintenance, beauty, and local help.',
    sortOrder: 50,
    schemaDefinition: {
      fields: [
        {
          key: 'serviceType',
          label: 'Service type',
          type: 'text',
          required: true,
        },
        { key: 'onsite', label: 'On-site service', type: 'toggle' },
        {
          key: 'availability',
          label: 'Availability',
          type: 'select',
          options: ['Today', 'Weekdays', 'Weekends'],
        },
      ],
    },
  },
];

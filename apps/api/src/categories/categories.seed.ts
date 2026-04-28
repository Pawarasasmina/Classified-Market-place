export const defaultCategories = [
  {
    name: 'Motors',
    slug: 'motors',
    description: 'Cars, bikes, spare parts, and dealer inventory.',
    schemaDefinition: {
      fields: [
        { key: 'make', type: 'select', required: true },
        { key: 'model', type: 'text', required: true },
        { key: 'year', type: 'number', required: true },
        { key: 'mileage', type: 'number' },
        { key: 'transmission', type: 'select' },
      ],
    },
  },
  {
    name: 'Property',
    slug: 'property',
    description: 'Apartments, villas, offices, and land.',
    schemaDefinition: {
      fields: [
        { key: 'propertyType', type: 'select', required: true },
        { key: 'bedrooms', type: 'number' },
        { key: 'bathrooms', type: 'number' },
        { key: 'area', type: 'number' },
        { key: 'furnished', type: 'toggle' },
      ],
    },
  },
  {
    name: 'Electronics',
    slug: 'electronics',
    description: 'Phones, laptops, consoles, and accessories.',
    schemaDefinition: {
      fields: [
        { key: 'brand', type: 'text', required: true },
        { key: 'storage', type: 'text' },
        { key: 'condition', type: 'select' },
        { key: 'warranty', type: 'toggle' },
      ],
    },
  },
  {
    name: 'Jobs',
    slug: 'jobs',
    description: 'Hiring, freelance gigs, and business opportunities.',
    schemaDefinition: {
      fields: [
        { key: 'jobType', type: 'select' },
        { key: 'experience', type: 'select' },
        { key: 'salary', type: 'number' },
      ],
    },
  },
  {
    name: 'Services',
    slug: 'services',
    description: 'Repair, maintenance, beauty, and local help.',
    schemaDefinition: {
      fields: [
        { key: 'serviceType', type: 'text', required: true },
        { key: 'onsite', type: 'toggle' },
        { key: 'availability', type: 'select' },
      ],
    },
  },
];

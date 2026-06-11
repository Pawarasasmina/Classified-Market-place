type DefaultCategory = {
  name: string;
  slug: string;
  description: string;
  imageUrl?: string;
  parentSlug?: string;
  sortOrder?: number;
  listingExpiryDays?: number;
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

export const categoryImageUrls: Record<string, string> = {
  vehicles:
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=80',
  motorcycles:
    'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=900&q=80',
  'heavy-equipment':
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=900&q=80',
  'boats-watercraft':
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
  'boats-and-watercraft':
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
  motors:
    'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=80',
  cars:
    'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=80',
  property:
    'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=80',
  apartments:
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80',
  'residential-for-rent':
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80',
  'residential-for-sale':
    'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=900&q=80',
  'commercial-for-rent':
    'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80',
  'commercial-for-sale':
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=80',
  'land-and-plots':
    'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80',
  electronics:
    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80',
  'mobile-phones-and-tablets':
    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80',
  'laptops-and-computers':
    'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80',
  'tvs-audio-and-cameras':
    'https://images.unsplash.com/photo-1495567720989-cebdbdd97913?auto=format&fit=crop&w=900&q=80',
  'home-appliances':
    'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=80',
  jobs:
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80',
  'it-software-development':
    'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=900&q=80',
  'healthcare-medical':
    'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=900&q=80',
  'sales-marketing':
    'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=80',
  'education-teaching':
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80',
  services:
    'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80',
  'web-software-development':
    'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=900&q=80',
  'home-maintenance-repair':
    'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=900&q=80',
  'legal-financial-services':
    'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=900&q=80',
};

export const defaultCategories: DefaultCategory[] = [
  {
    name: 'Motors',
    slug: 'motors',
    description: 'Cars, bikes, spare parts, and dealer inventory.',
    imageUrl: categoryImageUrls.motors,
    sortOrder: 10,
  },
  {
    name: 'Cars',
    slug: 'cars',
    parentSlug: 'motors',
    description: 'Used and new cars from private sellers and dealers.',
    imageUrl: categoryImageUrls.cars,
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
    imageUrl: categoryImageUrls.property,
    sortOrder: 20,
    listingExpiryDays: 60,
  },
  {
    name: 'Apartments',
    slug: 'apartments',
    parentSlug: 'property',
    description: 'Apartments for rent or sale.',
    imageUrl: categoryImageUrls.apartments,
    sortOrder: 21,
    listingExpiryDays: 60,
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
        {
          key: 'area',
          label: 'Area',
          type: 'number',
          placeholder: '1200 sqft',
        },
        { key: 'furnished', label: 'Furnished', type: 'toggle' },
      ],
    },
  },
  {
    name: 'Electronics',
    slug: 'electronics',
    description: 'Phones, laptops, consoles, and accessories.',
    imageUrl: categoryImageUrls.electronics,
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
    imageUrl: categoryImageUrls.jobs,
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
    imageUrl: categoryImageUrls.services,
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

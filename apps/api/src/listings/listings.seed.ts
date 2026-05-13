import { ListingStatus, Prisma } from '@prisma/client';

export const demoSellers = [
  {
    email: 'samira@classified.local',
    displayName: 'Samira Hassan',
    phone: '+971501111111',
    phoneVerified: true,
    emailVerified: true,
    role: 'USER',
  },
  {
    email: 'amira@classified.local',
    displayName: 'Amira Realty',
    phone: '+971502222222',
    phoneVerified: true,
    emailVerified: true,
    role: 'USER',
  },
  {
    email: 'faisal@classified.local',
    displayName: 'Faisal Tech Hub',
    phone: '+971503333333',
    phoneVerified: true,
    emailVerified: true,
    role: 'USER',
  },
  {
    email: 'corporate.hr@classified.local',
    displayName: 'Omar Hiring Team',
    phone: '+971505555555',
    phoneVerified: true,
    emailVerified: true,
    role: 'USER',
  },
] as const;

export const defaultListings = [
  {
    sellerEmail: 'samira@classified.local',
    categorySlug: 'motors',
    title: '2022 Toyota Camry SE',
    description:
      'Single-owner Camry in excellent condition with full service history, lane assist, and Apple CarPlay.',
    price: new Prisma.Decimal(67500),
    currency: 'AED',
    location: 'Dubai Marina',
    status: ListingStatus.ACTIVE,
    attributes: {
      make: 'Toyota',
      model: 'Camry',
      year: 2022,
      mileage: 45000,
      transmission: 'Automatic',
      condition: 'Used',
    },
  },
  {
    sellerEmail: 'amira@classified.local',
    categorySlug: 'property',
    title: '2BR Marina apartment with balcony',
    description:
      'Bright two-bedroom apartment with balcony, pool access, covered parking, and a short walk to the tram.',
    price: new Prisma.Decimal(8500),
    currency: 'AED',
    location: 'Dubai Marina',
    status: ListingStatus.ACTIVE,
    attributes: {
      propertyType: 'Apartment',
      bedrooms: 2,
      bathrooms: 2,
      area: 1240,
      furnished: true,
    },
  },
  {
    sellerEmail: 'faisal@classified.local',
    categorySlug: 'electronics',
    title: 'iPhone 15 Pro Max 256GB',
    description:
      'Used gently for three months, battery health at 100%, original box included. Meetup available in Sharjah.',
    price: new Prisma.Decimal(3650),
    currency: 'AED',
    location: 'Sharjah',
    status: ListingStatus.ACTIVE,
    attributes: {
      brand: 'Apple',
      storage: '256GB',
      condition: 'Like new',
      warranty: false,
    },
  },
  {
    sellerEmail: 'samira@classified.local',
    categorySlug: 'services',
    title: 'Same-day AC repair and cleaning',
    description:
      'Fast-response AC service for apartments and villas. Coil cleaning, gas top-up, and maintenance report included.',
    price: new Prisma.Decimal(120),
    currency: 'AED',
    location: 'Dubai',
    status: ListingStatus.ACTIVE,
    attributes: {
      serviceType: 'AC repair',
      onsite: true,
      availability: 'Today',
    },
  },
  {
    sellerEmail: 'samira@classified.local',
    categorySlug: 'jobs',
    title: 'Marketing Manager for local commerce brand',
    description:
      'Growth-minded marketing manager needed for campaign planning, marketplace partnerships, and analytics reporting.',
    price: new Prisma.Decimal(9000),
    currency: 'AED',
    location: 'Business Bay',
    status: ListingStatus.ACTIVE,
    attributes: {
      jobType: 'Full-time',
      experience: 'Mid',
      salary: 9000,
    },
  },
  {
    sellerEmail: 'corporate.hr@classified.local',
    categorySlug: 'jobs',
    title: 'Senior React Developer',
    description:
      'Product engineering team hiring a senior React developer for dashboard architecture, performance tuning, and mentoring across a fast-moving commerce platform.',
    price: new Prisma.Decimal(18000),
    currency: 'AED',
    location: 'Dubai Internet City',
    status: ListingStatus.ACTIVE,
    attributes: {
      jobType: 'Full-time',
      experience: 'Senior',
      salary: 18000,
    },
  },
] as const;

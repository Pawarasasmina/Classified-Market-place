import { ListingStatus, Prisma } from '@prisma/client';

export const demoSellers = [
  {
    email: 'admin@classified.local',
    displayName: 'Marketplace Admin',
    phone: '+971500000000',
    phoneVerified: true,
    emailVerified: true,
    role: 'ADMIN',
    password: 'Admin123!',
  },
  {
    email: 'samira@classified.local',
    displayName: 'Samira Hassan',
    phone: '+971501111111',
    phoneVerified: true,
    emailVerified: true,
    role: 'USER',
    password: 'Password123!',
  },
  {
    email: 'amira@classified.local',
    displayName: 'Amira Realty',
    phone: '+971502222222',
    phoneVerified: true,
    emailVerified: true,
    role: 'USER',
    password: 'Password123!',
  },
  {
    email: 'faisal@classified.local',
    displayName: 'Faisal Tech Hub',
    phone: '+971503333333',
    phoneVerified: true,
    emailVerified: true,
    role: 'USER',
    password: 'Password123!',
  },
] as const;

export const defaultListings = [
  {
    sellerEmail: 'samira@classified.local',
    categorySlug: 'cars',
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
    imageUrls: [
      'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=900&q=80',
    ],
  },
  {
    sellerEmail: 'amira@classified.local',
    categorySlug: 'apartments',
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
    imageUrls: [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80',
    ],
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
    imageUrls: [
      'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=900&q=80',
    ],
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
    imageUrls: [
      'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=900&q=80',
    ],
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
    imageUrls: [
      'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=80',
    ],
  },
] as const;

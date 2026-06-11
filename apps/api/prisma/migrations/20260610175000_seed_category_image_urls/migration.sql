UPDATE "Category"
SET "imageUrl" = 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=80'
WHERE "slug" = 'vehicles' AND COALESCE("imageUrl", '') = '';

UPDATE "Category"
SET "imageUrl" = 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=900&q=80'
WHERE "slug" = 'motorcycles' AND COALESCE("imageUrl", '') = '';

UPDATE "Category"
SET "imageUrl" = 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=900&q=80'
WHERE "slug" = 'heavy-equipment' AND COALESCE("imageUrl", '') = '';

UPDATE "Category"
SET "imageUrl" = 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80'
WHERE "slug" IN ('boats-watercraft', 'boats-and-watercraft') AND COALESCE("imageUrl", '') = '';

UPDATE "Category"
SET "imageUrl" = 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=80'
WHERE "slug" IN ('motors', 'cars') AND COALESCE("imageUrl", '') = '';

UPDATE "Category"
SET "imageUrl" = 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=80'
WHERE "slug" = 'property' AND COALESCE("imageUrl", '') = '';

UPDATE "Category"
SET "imageUrl" = 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80'
WHERE "slug" IN ('apartments', 'residential-for-rent') AND COALESCE("imageUrl", '') = '';

UPDATE "Category"
SET "imageUrl" = 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=900&q=80'
WHERE "slug" = 'residential-for-sale' AND COALESCE("imageUrl", '') = '';

UPDATE "Category"
SET "imageUrl" = 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80'
WHERE "slug" = 'commercial-for-rent' AND COALESCE("imageUrl", '') = '';

UPDATE "Category"
SET "imageUrl" = 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=80'
WHERE "slug" = 'commercial-for-sale' AND COALESCE("imageUrl", '') = '';

UPDATE "Category"
SET "imageUrl" = 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80'
WHERE "slug" = 'land-and-plots' AND COALESCE("imageUrl", '') = '';

UPDATE "Category"
SET "imageUrl" = 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80'
WHERE "slug" IN ('electronics', 'mobile-phones-and-tablets') AND COALESCE("imageUrl", '') = '';

UPDATE "Category"
SET "imageUrl" = 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80'
WHERE "slug" = 'laptops-and-computers' AND COALESCE("imageUrl", '') = '';

UPDATE "Category"
SET "imageUrl" = 'https://images.unsplash.com/photo-1495567720989-cebdbdd97913?auto=format&fit=crop&w=900&q=80'
WHERE "slug" = 'tvs-audio-and-cameras' AND COALESCE("imageUrl", '') = '';

UPDATE "Category"
SET "imageUrl" = 'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=80'
WHERE "slug" = 'home-appliances' AND COALESCE("imageUrl", '') = '';

UPDATE "Category"
SET "imageUrl" = 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80'
WHERE "slug" = 'jobs' AND COALESCE("imageUrl", '') = '';

UPDATE "Category"
SET "imageUrl" = 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=900&q=80'
WHERE "slug" IN ('it-software-development', 'web-software-development') AND COALESCE("imageUrl", '') = '';

UPDATE "Category"
SET "imageUrl" = 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=900&q=80'
WHERE "slug" = 'healthcare-medical' AND COALESCE("imageUrl", '') = '';

UPDATE "Category"
SET "imageUrl" = 'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=80'
WHERE "slug" = 'sales-marketing' AND COALESCE("imageUrl", '') = '';

UPDATE "Category"
SET "imageUrl" = 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80'
WHERE "slug" = 'education-teaching' AND COALESCE("imageUrl", '') = '';

UPDATE "Category"
SET "imageUrl" = 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80'
WHERE "slug" = 'services' AND COALESCE("imageUrl", '') = '';

UPDATE "Category"
SET "imageUrl" = 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=900&q=80'
WHERE "slug" = 'home-maintenance-repair' AND COALESCE("imageUrl", '') = '';

UPDATE "Category"
SET "imageUrl" = 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=900&q=80'
WHERE "slug" = 'legal-financial-services' AND COALESCE("imageUrl", '') = '';

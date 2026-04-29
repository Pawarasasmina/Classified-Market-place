type ListingMediaInput = {
  id: string;
  title: string;
  categorySlug: string;
  location: string;
  description: string;
  imageUrl?: string;
  imagePalette: string[];
};

type ListingPhoto = {
  src: string;
  alt: string;
};

const listingPhotoLibrary = {
  motors: {
    src: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1400&q=80",
    alt: "A polished sedan parked outdoors",
  },
  property: {
    src: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80",
    alt: "A bright modern apartment living room",
  },
  electronics: {
    src: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1400&q=80",
    alt: "A premium smartphone shown in a hand",
  },
  services: {
    src: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1400&q=80",
    alt: "A home service professional working indoors",
  },
  jobs: {
    src: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1400&q=80",
    alt: "A team working together in a bright office",
  },
  fallback: {
    src: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1400&q=80",
    alt: "A modern city building",
  },
} as const;

const titleSpecificPhotos: Array<{
  match: RegExp;
  photo: ListingPhoto;
}> = [
  {
    match: /(camry|toyota|sedan)/i,
    photo: {
      src: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1400&q=80",
      alt: "A clean sedan photographed from the front side",
    },
  },
  {
    match: /(apartment|balcony|marina|villa|property)/i,
    photo: {
      src: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80",
      alt: "A contemporary apartment interior with natural light",
    },
  },
  {
    match: /(iphone|phone|apple|smartphone)/i,
    photo: {
      src: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1400&q=80",
      alt: "A close-up of a modern smartphone",
    },
  },
  {
    match: /(playstation|ps5|console|gaming)/i,
    photo: {
      src: "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?auto=format&fit=crop&w=1400&q=80",
      alt: "A gaming setup with a console controller",
    },
  },
  {
    match: /(ac repair|cleaning|service|maintenance)/i,
    photo: {
      src: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1400&q=80",
      alt: "A maintenance professional working in a home",
    },
  },
  {
    match: /(marketing|manager|job|hiring|office)/i,
    photo: {
      src: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1400&q=80",
      alt: "A collaborative office meeting in progress",
    },
  },
];

export function getListingMedia(listing: ListingMediaInput) {
  if (listing.imageUrl) {
    return {
      src: listing.imageUrl,
      alt: `${listing.title} in ${listing.location}. Uploaded listing photo.`,
      overlay: `linear-gradient(180deg, rgba(13, 18, 28, 0.06) 0%, ${hexToRgba(
        listing.imagePalette[0] ?? "#1f6b5a",
        0.24
      )} 100%)`,
    };
  }

  const specificMatch = titleSpecificPhotos.find(({ match }) => match.test(listing.title));
  const categoryMatch =
    listingPhotoLibrary[listing.categorySlug as keyof typeof listingPhotoLibrary] ??
    listingPhotoLibrary.fallback;
  const photo = specificMatch?.photo ?? categoryMatch;
  const overlay = `linear-gradient(180deg, rgba(13, 18, 28, 0.06) 0%, ${hexToRgba(
    listing.imagePalette[0] ?? "#1f6b5a",
    0.3
  )} 100%)`;

  return {
    src: photo.src,
    alt: `${listing.title} in ${listing.location}. ${photo.alt}`,
    overlay,
  };
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return `rgba(31, 107, 90, ${alpha})`;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

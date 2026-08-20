export const PRODUCT_FIELDS = `
  _id,
  productName,
  productDescription,
  productPrice,
  discountPrice,
  discountStatus,
  availabilityStatus,
  "slug": slug.current,

  productImages[]{
    caption,
    attribution,
    "url": asset->url
  },

  productCategory[]->{
    _id,
    categoryName
  },

  productSection[]->{
    _id,
    sectionName
  },

  productSize[]->{
    _id,
    sizeName,
    abbreviation
  },

  productColor[]->{
    _id,
    colorName,
    colorCode
  }
`;
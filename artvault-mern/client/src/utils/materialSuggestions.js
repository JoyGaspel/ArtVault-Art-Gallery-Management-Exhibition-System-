const BY_CATEGORY = {
  'Digital Art': ['Apple Pencil', 'Drawing Pad', 'Digital Tablet', 'Procreate', 'Photoshop'],
  Illustration: ['Apple Pencil', 'Drawing Pad', 'Colored Pencil', 'Ink', 'Paper'],
  'Textile Art': ['Cotton Thread', 'Fabric', 'Natural Dye', 'Wool Yarn'],
  Crafts: ['Cardboard', 'Glue', 'Paper', 'Recycled Plastic'],
  Photography: ['Digital Camera', 'Camera Lens', 'Photographic Paper'],
  Sculpture: ['Clay', 'Stone', 'Wood', 'Plaster'],
  Painting: ['Acrylic Paint', 'Canvas', 'Oil Paint', 'Watercolor Paper'],
  'Traditional Art': ['Canvas', 'Charcoal', 'Graphite Pencil', 'Ink', 'Paper'],
  'Mixed Media': ['Acrylic Paint', 'Fabric', 'Paper', 'Photographic Print'],
  Calligraphy: ['Brush Pen', 'Ink', 'Paper'],
};

export function suggestedMaterials(categories = []) {
  return [...new Set(categories.flatMap((category) => BY_CATEGORY[category] || []))];
}

export function appendMaterial(current, suggestion) {
  const values = current.split(',').map((value) => value.trim()).filter(Boolean);
  if (values.some((value) => value.toLocaleLowerCase() === suggestion.toLocaleLowerCase())) return current;
  return [...values, suggestion].join(', ');
}

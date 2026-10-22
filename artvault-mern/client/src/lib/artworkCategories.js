export function categoryError(categories) {
  if (!Array.isArray(categories) || !categories.length || categories.length > 5) return 'Choose between 1 and 5 categories.';
  if (categories.some((item) => typeof item !== 'string' || !item.trim() || item.trim().length > 40
    || /^(others?|all)$/i.test(item.trim()) || !/^[\p{L}\p{N}][\p{L}\p{N}\s.'’()&+/-]*$/u.test(item.trim()))
    || new Set(categories.map((item) => item.trim().toLowerCase())).size !== categories.length) {
    return 'Specify a distinct specialization for Others, up to 40 characters. Use a name such as Pixel Art.';
  }
  return '';
}

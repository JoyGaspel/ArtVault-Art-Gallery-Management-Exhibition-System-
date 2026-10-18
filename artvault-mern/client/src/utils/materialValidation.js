import materialTerms from '../data/materialTerms.json';

const knownTerms = new Set(materialTerms);

export function materialError(value) {
  const list = value.split(',').map((item) => item.trim()).filter(Boolean);
  if (list.length > 20 || list.some((item) => item.length > 80)) return 'Use at most 20 materials, each 80 characters or fewer.';
  if (new Set(list.map((item) => item.toLocaleLowerCase())).size !== list.length) return 'List each material only once.';
  for (const item of list) {
    if (!/^[\p{L}\p{N}\s.'’()&+/-]+$/u.test(item) || /(?:https?:\/\/|www\.|\S+@\S+|(.)\1{4,})/iu.test(item)) {
      return 'Enter material names, not links, symbols, or placeholder text.';
    }
    const words = item.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
    if (!words.length || words.some((word) => !knownTerms.has(word))) {
      return `Material not recognized: ${item}. Try a specific name such as canvas, acrylic paint, or cotton thread.`;
    }
  }
  return '';
}

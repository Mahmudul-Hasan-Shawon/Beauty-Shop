import c1 from './content_1.jpg';
import c2 from './content_2.jpg';
import c3 from './content_3.jpg';
import c4 from './content_4.jpg';

const BY_SLUG = {
  'the-rice-water-ritual-brightening-from-the-first-wash': c1,
  'spf-decoded-choosing-the-right-sunscreen-for-bondhan-season': c2,
  'snail-mucin-explained-the-96-essence-cult-classic': c3,
  '7-step-glass-skin-routine-for-humid-weather': c4
};

const BY_INDEX = [c1, c2, c3, c4];

export function journalCover(article, index) {
  if (article && BY_SLUG[article.slug]) return BY_SLUG[article.slug];
  if (typeof index === 'number' && BY_INDEX[index]) return BY_INDEX[index];
  return (article && article.cover) || c1;
}

import type { ItemCategory } from '../generated/prisma/enums';
import { m } from '#lib/paraglide/messages.js';

// Two-level taxonomy of the pieces, as wardrobe apps do: a few groups, each with its types.
// Labels come from the translation files, so they follow the user's language everywhere.

export const CATEGORY_GROUPS = [
	'TOPS',
	'BOTTOMS',
	'ONE_PIECE',
	'OUTERWEAR',
	'HEADWEAR',
	'ACCESSORIES',
	'FOOTWEAR',
	'UNSORTED'
] as const;
export type CategoryGroup = (typeof CATEGORY_GROUPS)[number];

export const CATEGORIES_BY_GROUP: Record<CategoryGroup, ItemCategory[]> = {
	TOPS: [
		'T_SHIRT',
		'SHIRT',
		'TANK_TOP',
		'BODYSUIT',
		'SWEATER',
		'VEST',
		'POLO',
		'CROP_TOP',
		'CORSET',
		'TUNIC',
		'TOP_OTHER'
	],
	BOTTOMS: ['TROUSERS', 'JEANS', 'SHORTS', 'SKIRT', 'LEGGINGS', 'BOTTOM_OTHER'],
	ONE_PIECE: ['DRESS', 'JUMPSUIT', 'DUNGAREES', 'SET', 'FULL_COSTUME'],
	OUTERWEAR: ['JACKET', 'BLAZER', 'COAT', 'CAPE', 'TAILCOAT', 'TRACKSUIT', 'OUTERWEAR_OTHER'],
	HEADWEAR: ['HAT', 'TOP_HAT', 'CAP', 'HOOD', 'WIG', 'HEADWEAR_OTHER'],
	ACCESSORIES: [
		'SCARF',
		'BELT',
		'GLOVES',
		'MASK',
		'SOCKS',
		'JEWELRY',
		'BOA',
		'PROP',
		'DECORATION',
		'ACCESSORY_OTHER'
	],
	FOOTWEAR: ['SHOES', 'BOOTS', 'FOOTWEAR_OTHER'],
	UNSORTED: ['UNSORTED']
};

export const CATEGORIES: ItemCategory[] = CATEGORY_GROUPS.flatMap(
	(group) => CATEGORIES_BY_GROUP[group]
);

export const GROUP_OF: Record<ItemCategory, CategoryGroup> = Object.fromEntries(
	CATEGORY_GROUPS.flatMap((group) =>
		CATEGORIES_BY_GROUP[group].map((category) => [category, group])
	)
) as Record<ItemCategory, CategoryGroup>;

type Locale = 'fr' | 'en';
type Label = (inputs: object, options?: { locale: Locale }) => string;

const LABELS: Record<ItemCategory, Label> = {
	T_SHIRT: m.cat_t_shirt,
	SHIRT: m.cat_shirt,
	TANK_TOP: m.cat_tank_top,
	BODYSUIT: m.cat_bodysuit,
	SWEATER: m.cat_sweater,
	VEST: m.cat_vest,
	POLO: m.cat_polo,
	CROP_TOP: m.cat_crop_top,
	CORSET: m.cat_corset,
	TUNIC: m.cat_tunic,
	TOP_OTHER: m.cat_top_other,
	TROUSERS: m.cat_trousers,
	JEANS: m.cat_jeans,
	SHORTS: m.cat_shorts,
	SKIRT: m.cat_skirt,
	LEGGINGS: m.cat_leggings,
	BOTTOM_OTHER: m.cat_bottom_other,
	DRESS: m.cat_dress,
	JUMPSUIT: m.cat_jumpsuit,
	DUNGAREES: m.cat_dungarees,
	SET: m.cat_set,
	FULL_COSTUME: m.cat_full_costume,
	JACKET: m.cat_jacket,
	BLAZER: m.cat_blazer,
	COAT: m.cat_coat,
	CAPE: m.cat_cape,
	TAILCOAT: m.cat_tailcoat,
	TRACKSUIT: m.cat_tracksuit,
	OUTERWEAR_OTHER: m.cat_outerwear_other,
	HAT: m.cat_hat,
	TOP_HAT: m.cat_top_hat,
	CAP: m.cat_cap,
	HOOD: m.cat_hood,
	WIG: m.cat_wig,
	HEADWEAR_OTHER: m.cat_headwear_other,
	SCARF: m.cat_scarf,
	BELT: m.cat_belt,
	GLOVES: m.cat_gloves,
	MASK: m.cat_mask,
	SOCKS: m.cat_socks,
	JEWELRY: m.cat_jewelry,
	BOA: m.cat_boa,
	PROP: m.cat_prop,
	DECORATION: m.cat_decoration,
	ACCESSORY_OTHER: m.cat_accessory_other,
	SHOES: m.cat_shoes,
	BOOTS: m.cat_boots,
	FOOTWEAR_OTHER: m.cat_footwear_other,
	UNSORTED: m.cat_unsorted
};

const GROUP_LABELS: Record<CategoryGroup, Label> = {
	TOPS: m.catgroup_tops,
	BOTTOMS: m.catgroup_bottoms,
	ONE_PIECE: m.catgroup_one_piece,
	OUTERWEAR: m.catgroup_outerwear,
	HEADWEAR: m.catgroup_headwear,
	ACCESSORIES: m.catgroup_accessories,
	FOOTWEAR: m.catgroup_footwear,
	UNSORTED: m.catgroup_unsorted
};

const options = (locale?: Locale) => (locale ? { locale } : undefined);

export const categoryLabel = (category: ItemCategory, locale?: Locale) =>
	LABELS[category]({}, options(locale));
export const categoryGroupLabel = (group: CategoryGroup, locale?: Locale) =>
	GROUP_LABELS[group]({}, options(locale));

/** Both languages' labels of a category and its group, for search indexes. */
export const categorySearchText = (category: ItemCategory) =>
	[
		categoryLabel(category, 'fr'),
		categoryLabel(category, 'en'),
		categoryGroupLabel(GROUP_OF[category], 'fr'),
		categoryGroupLabel(GROUP_OF[category], 'en')
	].join(' ');

export function isCategory(value: string): value is ItemCategory {
	return (CATEGORIES as string[]).includes(value);
}

// --- Classification of free-text names (Drive import, data migration) ------------------------

const normalize = (text: string) =>
	text
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/pentalon/g, 'pantalon');

/**
 * Rules tried in order: the first whose keywords all appear in the name wins (`any` = at least
 * one of them, `all` = every one). Keywords are matched on the accent-stripped lowercase name.
 */
export const CLASSIFICATION_RULES: { category: ItemCategory; any?: string[]; all?: string[] }[] = [
	{ category: 'SET', all: ['pantalon', 'veste'] },
	{ category: 'SET', all: ['pantalon', 'chemise'] },
	{ category: 'SET', all: ['haut', 'pantalon'] },
	{ category: 'TOP_HAT', any: ['haut de forme', 'haut-de-forme'] },
	{ category: 'CAP', any: ['calot', 'casquette', 'beret'] },
	{ category: 'HOOD', any: ['capuche'] },
	{ category: 'HAT', any: ['chapeau'] },
	{ category: 'WIG', any: ['perruque'] },
	{ category: 'MASK', any: ['masque'] },
	{ category: 'SCARF', any: ['foulard', 'echarpe', 'bandana'] },
	{ category: 'BELT', any: ['ceinture'] },
	{ category: 'GLOVES', any: ['gant'] },
	{ category: 'SOCKS', any: ['chaussette'] },
	{ category: 'BOA', any: ['boa '] },
	{ category: 'BOA', any: ['boa'] },
	{ category: 'DECORATION', any: ['guirlande', 'bolduc', 'fleurs', 'decoration'] },
	{
		category: 'PROP',
		any: ['nez clown', 'brassard', 'epaulette', 'patch', 'elastique', 'goodies']
	},
	{ category: 'TAILCOAT', any: ['queue de pie', 'queue-de-pie'] },
	{ category: 'CAPE', any: ['cape'] },
	{ category: 'COAT', any: ['manteau', 'imper'] },
	{ category: 'TRACKSUIT', any: ['survetement', 'jogging'] },
	{ category: 'BLAZER', all: ['veste', 'costume'] },
	{ category: 'JACKET', any: ['veste', 'blouson'] },
	{ category: 'VEST', any: ['gilet'] },
	{ category: 'JUMPSUIT', any: ['combinaison'] },
	{ category: 'DUNGAREES', any: ['salopette'] },
	{ category: 'DRESS', any: ['robe'] },
	{ category: 'FULL_COSTUME', any: ['deguisement', 'tenue', 'starwars', 'star wars'] },
	{ category: 'SET', any: ['ensemble'] },
	{ category: 'T_SHIRT', any: ['t-shirt', 'tshirt', 'tee-shirt'] },
	{ category: 'TANK_TOP', any: ['marcel', 'debardeur'] },
	{ category: 'SHIRT', any: ['chemise'] },
	{ category: 'BODYSUIT', any: ['body'] },
	{ category: 'SWEATER', any: ['pull', 'col roule', 'sweat'] },
	{ category: 'POLO', any: ['polo'] },
	{ category: 'CROP_TOP', any: ['crop top'] },
	{ category: 'CORSET', any: ['corset'] },
	{ category: 'TUNIC', any: ['tunique'] },
	{ category: 'TOP_OTHER', any: ['haut', 'dos nu', 'top'] },
	{ category: 'SHORTS', any: ['short', 'bermuda'] },
	{ category: 'JEANS', any: ['jean'] },
	{ category: 'SKIRT', any: ['jupe', 'jupon'] },
	{ category: 'LEGGINGS', any: ['legging'] },
	{ category: 'TROUSERS', any: ['pantalon', 'pantacourt', 'jambiere', 'pentalon'] },
	{ category: 'SHOES', any: ['chaussure', 'basket', 'escarpin'] },
	{ category: 'BOOTS', any: ['botte'] }
];

/** Fallback by the old free-text category (Drive folder names). */
const HINT_CATEGORY: Record<string, ItemCategory> = {
	haut: 'TOP_OTHER',
	jupe: 'SKIRT',
	pantalon: 'TROUSERS',
	short: 'SHORTS',
	robe: 'DRESS',
	combinaison: 'JUMPSUIT',
	salopette: 'DUNGAREES',
	veste: 'JACKET',
	ensemble: 'SET',
	accessoire: 'ACCESSORY_OTHER',
	chapeau: 'HAT',
	foulard: 'SCARF',
	guirlande: 'DECORATION',
	masque: 'MASK',
	perruque: 'WIG'
};

/** Best category for a piece name, with the old free-text category as a tie-breaker. */
export function classify(name: string, hint?: string | null): ItemCategory {
	const text = normalize(name);
	const hinted = hint ? HINT_CATEGORY[normalize(hint)] : undefined;
	// A "costume" is a full costume in the costumes folder, a suit (set) elsewhere.
	if (/\bcostumes?\b/.test(text) && !text.includes('veste')) {
		return hinted === 'SET' ? 'FULL_COSTUME' : 'SET';
	}
	if (hinted === 'DUNGAREES') return 'DUNGAREES';
	for (const rule of CLASSIFICATION_RULES) {
		const anyOk = !rule.any || rule.any.some((keyword) => text.includes(keyword));
		const allOk = !rule.all || rule.all.every((keyword) => text.includes(keyword));
		if (anyOk && allOk && (rule.any || rule.all)) return rule.category;
	}
	return hinted ?? 'UNSORTED';
}

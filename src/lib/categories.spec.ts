import { describe, expect, it } from 'vitest';
import { CATEGORIES, classify, GROUP_OF } from './categories';

describe('taxonomy', () => {
	it('lists every category exactly once with a group', () => {
		expect(new Set(CATEGORIES).size).toBe(CATEGORIES.length);
		for (const category of CATEGORIES) expect(GROUP_OF[category]).toBeDefined();
	});
});

describe('classify', () => {
	const cases: [string, string | null, string][] = [
		['Haut de forme paillettes', 'Haut', 'TOP_HAT'],
		['Chemise pirate', 'Haut', 'SHIRT'],
		['Robe T-shirt blanc bord fils', 'Robe', 'DRESS'],
		['Body shorty blanc empiècement chair', 'Haut', 'BODYSUIT'],
		['Short jean', 'Pantalon', 'SHORTS'],
		['Gilet jean brut', 'Haut', 'VEST'],
		['Jupon', 'Jupe', 'SKIRT'],
		["Jambière pattes d'eph", 'Pantalon', 'TROUSERS'],
		['Costume pirate', 'Ensemble', 'FULL_COSTUME'],
		['Costume gris rayé blanc', 'Veste', 'SET'],
		['Veste costume femme noir', 'Veste', 'BLAZER'],
		['Queue de pie noir', 'Veste', 'TAILCOAT'],
		['Pentalon+veste rouge', 'Pantalon', 'SET'],
		['Hauts et pantalon violet', 'Haut', 'SET'],
		['Jean', 'Salopette', 'DUNGAREES'],
		['Calot', 'Chapeau', 'CAP'],
		['Nez clown', 'Accessoire', 'PROP'],
		['Accessoires hawaïens', 'Accessoire', 'ACCESSORY_OTHER'],
		['mystère tie die', 'Non classé', 'UNSORTED'],
		['Marcel garçon boite', 'Haut', 'TANK_TOP'],
		['Dos nu blanc', 'Haut', 'TOP_OTHER'],
		['Col roulé bleu', 'Haut', 'SWEATER']
	];
	for (const [name, hint, expected] of cases) {
		it(`${name} → ${expected}`, () => expect(classify(name, hint)).toBe(expected));
	}
});

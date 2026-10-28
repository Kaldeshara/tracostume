import type { Prisma } from '../../generated/prisma/client';

/** Fields needed to show an item card with its current location. */
export const itemCardSelect = {
	id: true,
	code: true,
	name: true,
	category: true,
	color: true,
	size: true,
	condition: true,
	photos: { orderBy: { position: 'asc' }, take: 1, select: { id: true } },
	box: {
		select: {
			id: true,
			code: true,
			label: true,
			shelf: true,
			container: { select: { name: true } }
		}
	},
	loans: {
		where: { returnedAt: null },
		take: 1,
		select: {
			id: true,
			borrowerName: true,
			dueAt: true,
			checkedOutAt: true,
			collectedAt: true,
			borrowerUser: { select: { firstName: true, lastName: true } },
			contactUser: { select: { id: true, firstName: true, lastName: true } }
		}
	}
} satisfies Prisma.ItemSelect;

type RawCard = Prisma.ItemGetPayload<{ select: typeof itemCardSelect }>;

export function toItemCard(item: RawCard) {
	const { photos, loans, ...rest } = item;
	const loan = loans[0];
	return {
		...rest,
		photoId: photos.length ? photos[0].id : null,
		loan: loan
			? {
					id: loan.id,
					borrower: loan.borrowerUser
						? `${loan.borrowerUser.firstName} ${loan.borrowerUser.lastName}`
						: (loan.borrowerName ?? ''),
					dueAt: loan.dueAt,
					collectedAt: loan.collectedAt,
					contact: loan.contactUser
						? {
								id: loan.contactUser.id,
								name: `${loan.contactUser.firstName} ${loan.contactUser.lastName}`
							}
						: null,
					checkedOutAt: loan.checkedOutAt
				}
			: null
	};
}

export type ItemCard = ReturnType<typeof toItemCard>;

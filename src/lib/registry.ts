export function validateInn(raw: string): boolean {
	const inn = raw.replace(/\D/g, '');
	const digits = [...inn].map(Number);
	const check = (weights: number[], position: number) =>
		(weights.reduce((sum, weight, i) => sum + weight * digits[i], 0) % 11) % 10 ===
		digits[position];

	if (inn.length === 10) return check([2, 4, 10, 3, 5, 9, 4, 6, 8], 9);
	if (inn.length === 12) {
		return (
			check([7, 2, 4, 10, 3, 5, 9, 4, 6, 8], 10) && check([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8], 11)
		);
	}
	return false;
}

const CADASTRAL = /^\d{2}:\d{2}:\d{6,7}:\d{1,10}$/;

export function validateCadastral(raw: string): boolean {
	return CADASTRAL.test(raw.trim());
}

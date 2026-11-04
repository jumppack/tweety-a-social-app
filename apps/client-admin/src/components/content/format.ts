const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	["year", 365 * 24 * 60 * 60],
	["month", 30 * 24 * 60 * 60],
	["week", 7 * 24 * 60 * 60],
	["day", 24 * 60 * 60],
	["hour", 60 * 60],
	["minute", 60],
];

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "just now", "5 minutes ago", "yesterday", "3 weeks ago"… */
export function formatRelativeTime(date: Date, now = Date.now()): string {
	const seconds = Math.round((new Date(date).getTime() - now) / 1000);
	const abs = Math.abs(seconds);
	if (abs < 60) return "just now";
	for (const [unit, size] of UNITS) {
		if (abs >= size) return relative.format(Math.trunc(seconds / size), unit);
	}
	return "just now";
}

export function formatDateTime(date: Date): string {
	return new Date(date).toLocaleString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

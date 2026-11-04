import { useCallback, useEffect, useRef, useState } from "react";
import type { ContentListInput } from "../../server/functions/content";

type Fetcher<T> = (input: ContentListInput) => Promise<{ items: T[]; total: number }>;

/**
 * Search + "reported only" filter + "Load more" paging over an admin content
 * list. Search is debounced, and a request counter drops responses from
 * superseded queries so a slow early search can't overwrite a later one.
 */
export function useContentList<T extends { id: string }>(fetcher: Fetcher<T>) {
	const [items, setItems] = useState<T[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");
	const [reportedOnly, setReportedOnly] = useState(false);
	const latestRequest = useRef(0);
	const fetcherRef = useRef(fetcher);
	fetcherRef.current = fetcher;

	const load = useCallback(async (query: string, reported: boolean) => {
		const requestId = ++latestRequest.current;
		setLoading(true);
		try {
			const result = await fetcherRef.current({ search: query, reportedOnly: reported, offset: 0 });
			if (requestId !== latestRequest.current) return; // a newer query is in flight
			setItems(result.items);
			setTotal(result.total);
			setError("");
		} catch (err) {
			if (requestId === latestRequest.current) {
				setError(err instanceof Error ? err.message : "Failed to load");
			}
		} finally {
			if (requestId === latestRequest.current) setLoading(false);
		}
	}, []);

	useEffect(() => {
		const timer = setTimeout(() => load(search, reportedOnly), search ? 250 : 0);
		return () => clearTimeout(timer);
	}, [search, reportedOnly, load]);

	const loadMore = async () => {
		const requestId = latestRequest.current;
		setLoadingMore(true);
		try {
			const result = await fetcherRef.current({ search, reportedOnly, offset: items.length });
			if (requestId !== latestRequest.current) return;
			setItems((prev) => {
				const seen = new Set(prev.map((item) => item.id));
				return [...prev, ...result.items.filter((item) => !seen.has(item.id))];
			});
			setTotal(result.total);
		} catch (err) {
			if (requestId === latestRequest.current) {
				setError(err instanceof Error ? err.message : "Failed to load more");
			}
		} finally {
			setLoadingMore(false);
		}
	};

	/** Drop a row the server has confirmed deleted, without a refetch. */
	const remove = (id: string) => {
		setItems((prev) => prev.filter((item) => item.id !== id));
		setTotal((t) => Math.max(0, t - 1));
	};

	return {
		items,
		total,
		loading,
		loadingMore,
		error,
		search,
		setSearch,
		reportedOnly,
		setReportedOnly,
		hasMore: items.length < total,
		loadMore,
		remove,
	};
}

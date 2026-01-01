'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { searchGlobal } from '@/lib/api/search';
import { SearchResult, SearchResultType, SearchParams } from '@/types/search';
import { SearchResultCard } from '@/components/SearchResultCard';
import { useI18n } from '@/hooks/use-i18n';
import { Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { SiteNavigation } from '@/components/SiteNavigation';

function SearchContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [selectedType, setSelectedType] = useState<SearchResultType | 'all'>('all');

  // Wrapper for searchGlobal that normalizes the response for useInfiniteList
  const searchGlobalNormalized = useCallback(async (params: SearchParams & { page: number; pageSize: number }) => {
    const response = await searchGlobal({
      q: params.q,
      page: params.page,
      page_size: params.pageSize,
      types: params.types,
    });
    // Normalize to format expected by useInfiniteList
    return {
      results: response.results,
      count: response.total,
      next: response.page * response.page_size < response.total ? 'has-more' : null,
    };
  }, []);

  // Use the infinite list hook for consistent pagination behavior
  const {
    items: results,
    loaderRef,
    hasMore,
    error: loadError,
    setError: setLoadError,
    loadMore,
    reset,
    totalCount,
    loading: isLoading,
  } = useInfiniteList<SearchResult, SearchParams>({
    pageFetcher: searchGlobalNormalized,
    initialParams: { q: query, page: 1, page_size: 20 },
    pageSize: 20,
    dedupeKey: (result) => `${result.type}-${result.id}`,
    autoLoad: false, // We'll trigger loading manually after query/filter changes
    enabled: !!query.trim(),
  });

  // Reset and load when query or type filter changes
  useEffect(() => {
    if (!query.trim()) return;

    // Build search params inline to avoid dependency issues
    const types = selectedType === 'all' ? undefined : selectedType;
    const params: SearchParams = {
      q: query,
      page: 1,
      page_size: 20,
      types,
    };

    reset(params);
    // Use setTimeout(0) to defer execution after state update
    setTimeout(() => loadMore(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, selectedType]);

  const handleTypeFilter = (type: SearchResultType | 'all') => {
    setSelectedType(type);
  };

  const typeFilters: Array<{ value: SearchResultType | 'all'; label: string }> = [
    { value: 'all', label: t('search.types.all') },
    { value: 'course', label: t('search.types.course') },
    { value: 'forum_post', label: t('search.types.forum_post') },
    { value: 'forum_comment', label: t('search.types.forum_comment') },
    { value: 'course_review', label: t('search.types.course_review') },
    { value: 'wiki', label: t('search.types.wiki') },
    { value: 'teacher', label: t('search.types.teacher') },
    { value: 'user', label: t('search.types.user') },
  ];

  if (!query.trim()) {
    return (
      <div className="py-16">
        <div className="max-w-2xl mx-auto text-center">
          <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">
            {t('search.noResults')}
          </h1>
          <p className="text-muted-foreground">
            {t('search.enterSearchQuery')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">
            {t('search.resultsFor', { query })}
          </h1>
          {totalCount !== null && (
            <p className="text-muted-foreground">
              {t('search.totalResults', { count: totalCount })}
            </p>
          )}
        </div>

        {/* Type Filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          {typeFilters.map((filter) => (
            <Button
              key={filter.value}
              variant={selectedType === filter.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleTypeFilter(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>

        {/* Loading State */}
        {isLoading && results.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error State */}
        {loadError && results.length === 0 && (
          <div className="text-center py-16">
            <p className="text-destructive mb-4">{t('search.searchFailed')}</p>
            <Button onClick={() => { setLoadError(false); loadMore(); }}>{t('search.retry')}</Button>
          </div>
        )}

        {/* Results */}
        {!isLoading && results.length === 0 && !loadError && (
          <div className="text-center py-16">
            <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">
              {t('search.noResults')}
            </h2>
            <p className="text-muted-foreground">
              {t('search.noResultsForQuery', { query })}
            </p>
          </div>
        )}

        {results.length > 0 && (
          <>
            <div className="space-y-4">
              {results.map((result) => (
                <SearchResultCard
                  key={`${result.type}-${result.id}`}
                  result={result}
                  highlight={query}
                />
              ))}
            </div>

            {/* Infinite scroll sentinel and manual load more */}
            <div className="mt-8 text-center">
              <div ref={loaderRef} className="h-6 w-full" aria-hidden="true" />
              {hasMore && !isLoading && (
                <Button
                  onClick={loadMore}
                  variant="outline"
                  className="mt-2"
                >
                  {t('search.loadMore')} {totalCount !== null && `(${results.length} / ${totalCount})`}
                </Button>
              )}
              {isLoading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              )}
              {loadError && hasMore && (
                <Button
                  onClick={() => { setLoadError(false); loadMore(); }}
                  variant="outline"
                  className="mt-2"
                >
                  {t('search.loadFailedRetry')}
                </Button>
              )}
            </div>
          </>
        )}
    </div>
  );
}

function SearchPageLoading() {
  return (
    <div className="py-16">
      <div className="max-w-2xl mx-auto text-center">
        <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <>
      <SiteNavigation />
      <div className="min-h-screen bg-background">
        <main className="w-full py-6 sm:py-8">
          <div className="container mx-auto px-4 max-w-7xl">
            <Suspense fallback={<SearchPageLoading />}>
              <SearchContent />
            </Suspense>
          </div>
        </main>
      </div>
    </>
  );
}


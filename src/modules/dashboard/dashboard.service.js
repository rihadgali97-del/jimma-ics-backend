import { dashboardRepository } from './dashboard.repository.js';
import { getOrSetCache } from '../../common/utils/cache.js';

const CACHE_KEY = 'dashboard:summary';
const CACHE_TTL_SECONDS = 60; // short TTL — freshness matters more than saving a handful of queries

async function computeSummary() {
  const [
    applicationCounts,
    directoryCounts,
    waqfAssetCount,
    publishedFinancialReportCount,
  ] = await Promise.all([
    dashboardRepository.applicationCountsByStatus(),
    dashboardRepository.mosqueMadrasaCountsByWoreda(),
    dashboardRepository.countWaqfAssets(),
    dashboardRepository.countPublishedFinancialReports(),
  ]);

  const woredaIds = [
    ...new Set([
      ...directoryCounts.mosques.map((r) => r.woredaId),
      ...directoryCounts.madrasas.map((r) => r.woredaId),
    ]),
  ];
  const woredas = await dashboardRepository.findWoredaCodes(woredaIds);
  const woredaCodeById = Object.fromEntries(woredas.map((w) => [w.id, w.code]));

  return {
    applications: {
      zakat: Object.fromEntries(
        applicationCounts.zakat.map((r) => [r.status, r._count._all])
      ),
      janazah: Object.fromEntries(
        applicationCounts.janazah.map((r) => [r.status, r._count._all])
      ),
    },
    directoryByWoreda: {
      mosques: directoryCounts.mosques.map((r) => ({
        woreda: woredaCodeById[r.woredaId] ?? null,
        count: r._count._all,
      })),
      madrasas: directoryCounts.madrasas.map((r) => ({
        woreda: woredaCodeById[r.woredaId] ?? null,
        count: r._count._all,
      })),
    },
    waqfAssetCount,
    publishedFinancialReportCount,
    generatedAt: new Date().toISOString(),
  };
}

export async function getDashboardSummary({ forceRefresh = false } = {}) {
  if (forceRefresh) {
    return computeSummary();
  }
  return getOrSetCache(CACHE_KEY, CACHE_TTL_SECONDS, computeSummary);
}

import { DataSource, DataSourceRequestHandler } from '../types';
import { getValueByPath, resolveWidgetIdValue } from './pathUtils';

type ApiDataSource = Extract<DataSource, { type: 'api' }>;

const apiDataSourceCache = new Map<string, any[]>();
const apiDataSourceInflight = new Map<string, Promise<any[]>>();

function buildApiRequestContext(
  dataSource: ApiDataSource,
  allValues: Record<string, any>,
  levelId?: string
): { service: string; endpoint: string; method: string; requestParams: Record<string, any> } | null {
  let depValue: any = null;
  if (dataSource.dependsOn) {
    if (dataSource.dependsOn.includes('.')) {
      depValue = getValueByPath(allValues, dataSource.dependsOn);
    } else {
      depValue = resolveWidgetIdValue(allValues, dataSource.dependsOn);
    }
    if (depValue === null || depValue === undefined || depValue === '') {
      return null;
    }
  }

  const method = dataSource.method || 'GET';
  const staticParams: Record<string, any> = { ...dataSource.params };
  const standardFields = ['type', 'service', 'endpoint', 'url', 'method', 'dependsOn', 'valueKey', 'labelKey', 'headers', 'body', 'params', 'level_id'];
  for (const [key, value] of Object.entries(dataSource)) {
    if (!standardFields.includes(key) && value !== undefined && value !== null) {
      staticParams[key] = value;
    }
  }
  if (levelId) {
    staticParams.level_id = levelId;
  }

  const requestParams: Record<string, any> = { ...staticParams };
  if (dataSource.dependsOn && depValue !== null && depValue !== undefined) {
    const parentValueId = typeof depValue === 'object' && depValue !== null
      ? (depValue.level_value_id || depValue.id || depValue.value || depValue)
      : depValue;
    if (staticParams.level_id) {
      requestParams.parent_level_value_id = parentValueId;
    } else {
      const paramKey = dataSource.dependsOn.split('.').pop() || 'filter';
      requestParams[paramKey] = parentValueId;
    }
  } else if (staticParams.level_id) {
    requestParams.parent_level_value_id = '';
  }

  const service = dataSource.service;
  const endpoint = dataSource.endpoint;
  if (!service || !endpoint) {
    return null;
  }

  return { service, endpoint, method, requestParams };
}

function buildApiDataSourceCacheKey(
  service: string,
  endpoint: string,
  method: string,
  requestParams: Record<string, any>
): string {
  return `${service}|${endpoint}|${method}|${JSON.stringify(requestParams)}`;
}

/** Return cached API options when already fetched (e.g. duplicate table cells). */
export function getCachedApiDataSource(
  dataSource: ApiDataSource,
  allValues: Record<string, any>,
  levelId?: string
): any[] | undefined {
  const context = buildApiRequestContext(dataSource, allValues, levelId);
  if (!context) {
    return undefined;
  }
  const cacheKey = buildApiDataSourceCacheKey(
    context.service,
    context.endpoint,
    context.method,
    context.requestParams
  );
  return apiDataSourceCache.get(cacheKey);
}

/**
 * Get static data source options
 */
export const getStaticDataSource = (dataSource: Extract<DataSource, { type: 'static' }>): any[] => {
  return dataSource.options || [];
};

/**
 * Get API data source options
 * Uses dataSourceRequestHandler to make API calls through host application
 */
export const getApiDataSource = async (
  dataSource: Extract<DataSource, { type: 'api' }>,
  allValues: Record<string, any>,
  dataSourceRequestHandler: DataSourceRequestHandler,
  levelId?: string // Optional level_id from widget-geo-config.level
): Promise<any[]> => {
  if (!dataSourceRequestHandler) {
    console.error('[getApiDataSource] dataSourceRequestHandler is required for API data sources');
    return [];
  }

  try {
    const context = buildApiRequestContext(dataSource, allValues, levelId);
    if (!context) {
      return [];
    }

    const { service, endpoint, method, requestParams } = context;
    const cacheKey = buildApiDataSourceCacheKey(service, endpoint, method, requestParams);

    const cached = apiDataSourceCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const inflight = apiDataSourceInflight.get(cacheKey);
    if (inflight) {
      return inflight;
    }

    const fetchPromise = (async () => {
      const response = await dataSourceRequestHandler(
        service,
        endpoint,
        method,
        requestParams,
        { headers: dataSource.headers }
      );
      const parsed = Array.isArray(response) ? response : [];

      apiDataSourceCache.set(cacheKey, parsed);
      return parsed;
    })();

    apiDataSourceInflight.set(cacheKey, fetchPromise);
    try {
      return await fetchPromise;
    } finally {
      apiDataSourceInflight.delete(cacheKey);
    }
  } catch (error) {
    throw error;
  }
};

export const getSchemaDataSource = (
  dataSource: Extract<DataSource, { type: 'schema' }>,
  schemaData: Record<string, any>
): any[] => {
  const data = getValueByPath(schemaData, dataSource.path);
  return Array.isArray(data) ? data : [];
};


export const transformDataSourceOptions = (
  data: any[],
  valueKey?: string,
  labelKey?: string
): Array<{ value: any; label: string }> => {
  if (!valueKey || !labelKey) {
    return data.map((item) => {
      if (typeof item === 'object' && 'value' in item && 'label' in item) {
        return item;
      }
      return { value: item, label: String(item) };
    });
  }

  return data.map((item) => {
    const value = item[valueKey];
    const label = item[labelKey] || item.name || item.label || item.mnemonic || item.level_value_mnemonic || String(value);
    return { value, label };
  });
};

import axios, { AxiosResponse } from "axios";
import fs from "fs";

type Url = string;
type AccessKey = [Url, Date];
type AxiosTimedCache = Map<Url, CacheObject>;

interface CacheObject {
  storedAt: Date;
  response: AxiosResponse;
}

const CACHE_LIFETIME = 1000 * 60 * 60 * 24 * 7 * 2; // 2 weeks in milliseconds
const accessCache: AxiosTimedCache = new Map(); // TODO: Persist this to disk

const isLifetimeExpired = (storedAt: Date, current: Date): boolean => {
  return current.getTime() - storedAt.getTime() > CACHE_LIFETIME;
};

const isExistingCacheItemInvalidated = ([url, time]: AccessKey): boolean => {
  const existing: CacheObject | undefined = accessCache.get(url);
  if (existing === undefined) {
    return true;
  }

  return isLifetimeExpired(existing.storedAt, time);
};

function persistCache() {
  // TODO
}

const cacheStore = ([url, time]: AccessKey, response: AxiosResponse) => {
  if (isExistingCacheItemInvalidated([url, time])) {
    accessCache.set(url, { response, storedAt: time });
    persistCache();
  }
};

const cacheInvalidate = (url: Url) => {
  accessCache.delete(url);
  persistCache();
};

async function cachedGet(url: string): Promise<AxiosResponse | undefined> {
  const time = new Date();
  const accessKey: AccessKey = [url, time];

  try {
    const response = await axios.get(url);
    if (response.status === 200) {
      cacheStore(accessKey, response);
    } else {
      cacheInvalidate(url);
    }
    return response;
  } catch {
    return undefined;
  }
}

// Clean up when starting the program
function onLoad() {
  // TODO: Load from disk
  const urls = accessCache.keys();
  const now = new Date();
  for (const url of urls) {
    if (isExistingCacheItemInvalidated([url, now])) {
      accessCache.delete(url);
    }
  }
}

onLoad();

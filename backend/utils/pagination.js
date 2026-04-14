const MAX_SAFE_PAGE = 1_000_000;
const MAX_SAFE_LIMIT = 1_000;
const MAX_SAFE_OFFSET = Number.MAX_SAFE_INTEGER;

const toInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const parsePageLimit = (
  query = {},
  {
    defaultPage = 1,
    defaultLimit = 20,
    minLimit = 1,
    maxLimit = 100,
  } = {}
) => {
  const safeMaxLimit = clamp(maxLimit, minLimit, MAX_SAFE_LIMIT);
  const safeDefaultLimit = clamp(defaultLimit, minLimit, safeMaxLimit);
  const safeDefaultPage = clamp(defaultPage, 1, MAX_SAFE_PAGE);

  const page = clamp(toInteger(query.page, safeDefaultPage), 1, MAX_SAFE_PAGE);
  const limit = clamp(toInteger(query.limit, safeDefaultLimit), minLimit, safeMaxLimit);
  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

const parseOffsetLimit = (
  query = {},
  {
    defaultOffset = 0,
    defaultLimit = 20,
    minLimit = 1,
    maxLimit = 100,
  } = {}
) => {
  const safeMaxLimit = clamp(maxLimit, minLimit, MAX_SAFE_LIMIT);
  const safeDefaultLimit = clamp(defaultLimit, minLimit, safeMaxLimit);

  const offset = clamp(toInteger(query.offset, defaultOffset), 0, MAX_SAFE_OFFSET);
  const limit = clamp(toInteger(query.limit, safeDefaultLimit), minLimit, safeMaxLimit);

  return { offset, limit };
};

const buildPagePagination = ({ total = 0, page = 1, limit = 20 } = {}) => {
  const totalCount = Math.max(0, Number.parseInt(total, 10) || 0);
  const safeLimit = Math.max(1, Number.parseInt(limit, 10) || 1);
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const totalPages = Math.max(1, Math.ceil(totalCount / safeLimit));

  return {
    total: totalCount,
    page: safePage,
    limit: safeLimit,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPreviousPage: safePage > 1,
  };
};

const buildOffsetPagination = ({ total = 0, offset = 0, limit = 20 } = {}) => {
  const totalCount = Math.max(0, Number.parseInt(total, 10) || 0);
  const safeOffset = Math.max(0, Number.parseInt(offset, 10) || 0);
  const safeLimit = Math.max(1, Number.parseInt(limit, 10) || 1);

  return {
    total: totalCount,
    offset: safeOffset,
    limit: safeLimit,
    hasMore: safeOffset + safeLimit < totalCount,
  };
};

module.exports = {
  parsePageLimit,
  parseOffsetLimit,
  buildPagePagination,
  buildOffsetPagination,
};

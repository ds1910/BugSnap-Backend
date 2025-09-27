// -------------------------------------------
// Utility function to apply filtering, sorting, and pagination to any Mongoose model.
// Can be reused across multiple controllers.
// -------------------------------------------

const { validateDateInputs, buildDateRange } = require("./dateFilterUtils");
const BUGS_PER_PAGE = parseInt(process.env.BUGS_PER_PAGE) || 20;

/**
 * Applies dynamic filters, sorting, and pagination to a Mongoose model query.
 * Supports filters (status, priority, tags, assignee), date filtering, and pagination.
 *
 * @param {MongooseModel} model - The Mongoose model to query.
 * @param {Object} reqQuery - The query parameters from req.query.
 * @param {Object} baseFilter - Static filter object to merge with dynamic filters.
 * @returns {Promise<Object>} An object with { total, page, totalPages, data }.
 */
const applyQueryFeatures = async (model, reqQuery, baseFilter = {}) => {
  const {
    page = 1,
    limit,
    sortBy = 'createdAt',
    order = 'desc',
    dateField = 'startDate',
    dateFilter = 'any',
    value,
    start,
    end,
    ...filters // dynamic filters like status, priority, tags, assignee, etc.
  } = reqQuery;

  const query = { ...baseFilter };

  // Apply dynamic filters
  for (const key in filters) {
    if (filters[key]) {
      if (key === 'tags') {
        query[key] = { $in: filters[key].split(',') };
      } else {
        query[key] = filters[key];
      }
    }
  }

  // Date filtering
  validateDateInputs(dateFilter.toLowerCase(), dateField, value, start, end);
  const dateQueryRange = buildDateRange(dateFilter.toLowerCase(), value, start, end);
  if (Object.keys(dateQueryRange).length > 0) {
    query[dateField] = dateQueryRange;
  }

  // Pagination
  const rawLimit = parseInt(limit) || BUGS_PER_PAGE;
  const finalLimit = Math.min(rawLimit, BUGS_PER_PAGE);
  const currentPage = parseInt(page) || 1;
  const skip = (currentPage - 1) * finalLimit;

  // Sorting
  const sortOrder = order === 'asc' ? 1 : -1;
  const sort = { [sortBy]: sortOrder };

  // Execute query
  const totalDocs = await model.countDocuments(query);
  const results = await model.find(query).sort(sort).skip(skip).limit(finalLimit);

  return {
    total: totalDocs,
    page: currentPage,
    totalPages: Math.ceil(totalDocs / finalLimit),
    data: results,
  };
};

module.exports = applyQueryFeatures;

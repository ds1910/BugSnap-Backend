const moment = require('moment');

// ✅ Validate ISO date string
const isValidDate = (dateStr) => {
  return !isNaN(Date.parse(dateStr));
};

/**
 * 🔒 Validates user input for date filtering
 * @param {string} filter - The date filter type ('today', 'before', etc.)
 * @param {string} dateField - Field to filter on (must be in allowed list)
 * @param {string} value - Single date input for 'exact', 'before', 'after'
 * @param {string} start - Start of date range (for 'range')
 * @param {string} end - End of date range (for 'range')
 */
const validateDateInputs = (filter, dateField, value, start, end) => {
  const allowedFields = ['startDate', 'dueDate', 'createdAt'];
  if (!allowedFields.includes(dateField)) throw new Error('Invalid date field');

  if (['exact', 'before', 'after'].includes(filter)) {
    if (!isValidDate(value)) throw new Error('Invalid date value');
  }

  if (filter === 'range') {
    if (!isValidDate(start) || !isValidDate(end)) throw new Error('Invalid date range');
    if (new Date(start) > new Date(end)) throw new Error('Start date must be before end date');
  }
};

/**
 * 📅 Builds MongoDB-compatible date range query
 * @param {string} filter - Filter type (today, yesterday, etc.)
 * @param {string} value - Used for 'exact', 'before', 'after'
 * @param {string} start - Start date for 'range'
 * @param {string} end - End date for 'range'
 * @returns {Object} MongoDB query object for date range
 */
const buildDateRange = (filter, value, start, end) => {
  const today = moment().startOf('day');

  switch (filter) {
    case 'today':
      return { $gte: today.toDate(), $lte: moment(today).endOf('day').toDate() };

    case 'yesterday':
      const yStart = moment(today).subtract(1, 'day');
      return { $gte: yStart.toDate(), $lte: moment(yStart).endOf('day').toDate() };

    case 'last7days':
      return { $gte: moment(today).subtract(7, 'days').toDate(), $lte: moment(today).endOf('day').toDate() };

    case 'thisweek':
      return {
        $gte: moment().startOf('isoWeek').toDate(),  // Monday start
        $lte: moment().endOf('day').toDate(),
      };

    case 'lastweek':
      const lwStart = moment().subtract(1, 'week').startOf('isoWeek');
      const lwEnd = moment().subtract(1, 'week').endOf('isoWeek');
      return { $gte: lwStart.toDate(), $lte: lwEnd.toDate() };

    case 'thismonth':
      return { $gte: moment().startOf('month').toDate(), $lte: moment(today).endOf('day').toDate() };

    case 'lastmonth':
      return {
        $gte: moment().subtract(1, 'month').startOf('month').toDate(),
        $lte: moment().subtract(1, 'month').endOf('month').toDate(),
      };

    case 'thisquarter':
      return { $gte: moment().startOf('quarter').toDate(), $lte: moment(today).endOf('day').toDate() };

    case 'lastquarter':
      const lqStart = moment().subtract(1, 'quarter').startOf('quarter');
      const lqEnd = moment().subtract(1, 'quarter').endOf('quarter');
      return { $gte: lqStart.toDate(), $lte: lqEnd.toDate() };

    case 'thisyear':
      return { $gte: moment().startOf('year').toDate(), $lte: moment(today).endOf('day').toDate() };

    case 'lastyear':
      return {
        $gte: moment().subtract(1, 'year').startOf('year').toDate(),
        $lte: moment().subtract(1, 'year').endOf('year').toDate(),
      };

    case 'nextyear':
      return {
        $gte: moment().add(1, 'year').startOf('year').toDate(),
        $lte: moment().add(1, 'year').endOf('year').toDate(),
      };

    case 'exact':
      return {
        $gte: moment(value).startOf('day').toDate(),
        $lte: moment(value).endOf('day').toDate(),
      };

    case 'before':
      return { $lt: new Date(value) };

    case 'after':
      return { $gt: new Date(value) };

    case 'range':
      return { $gte: new Date(start), $lte: new Date(end) };

    case 'any':
    default:
      return {}; // No filter applied
  }
};

module.exports = {
  isValidDate,
  validateDateInputs,
  buildDateRange,
};

const Artwork = require('../models/Artwork');
const Entry = require('../models/SubmitExhibitEntry');

function analyticsWindow(query, now = new Date()) {
  const today = new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
  const defaultFrom = new Date(new Date(`${today}T00:00:00+08:00`).getTime() - 29 * 86400000 + 8 * 3600000).toISOString().slice(0, 10);
  const from = query.from === undefined ? defaultFrom : query.from;
  const to = query.to === undefined ? today : query.to;
  function parse(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Object.assign(new Error('Choose valid start and end dates.'), { status: 400 });
    const date = new Date(`${value}T00:00:00+08:00`);
    if (Number.isNaN(date.getTime()) || new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 10) !== value) throw Object.assign(new Error('Choose valid start and end dates.'), { status: 400 });
    return date;
  }
  const start = parse(from); const end = new Date(parse(to).getTime() + 86400000);
  if (end <= start || end - start > 366 * 86400000) throw Object.assign(new Error('Choose an ordered date range of up to 366 days.'), { status: 400 });
  return { from, to, start, end };
}

async function getAnalytics(req, res, next) {
  try {
    const { from, to, start, end } = analyticsWindow(req.query);
    const now = new Date();
    const [artworkRows, entryRows] = await Promise.all([
      Artwork.aggregate([
        { $match: { created_at: { $gte: start, $lt: end } } },
        { $project: { created_at: 1, artist: 1, categories: 1, visibility: 1, reviewStatus: 1 } },
        { $facet: {
          totals: [{ $group: { _id: null, uploads: { $sum: 1 }, artists: { $addToSet: '$artist' }, pending: { $sum: { $cond: [{ $eq: ['$reviewStatus', 'pending'] }, 1, 0] } }, rejected: { $sum: { $cond: [{ $eq: ['$reviewStatus', 'rejected'] }, 1, 0] } } } }],
          trend: [{ $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at', timezone: 'Asia/Manila' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
          categories: [{ $match: { visibility: { $ne: 'private' }, reviewStatus: { $nin: ['pending', 'rejected'] } } }, { $project: { categories: { $setUnion: [{ $ifNull: ['$categories', []] }, []] } } }, { $unwind: '$categories' }, { $group: { _id: '$categories', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }, { $limit: 25 }],
          backlog: [{ $match: { reviewStatus: 'pending' } }, { $group: { _id: null, oldest: { $min: '$created_at' }, overSevenDays: { $sum: { $cond: [{ $lt: ['$created_at', new Date(now.getTime() - 7 * 86400000)] }, 1, 0] } } } }],
        } },
      ]),
      Entry.aggregate([{ $match: { createdAt: { $gte: start, $lt: end } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);
    const data = artworkRows[0] || {};
    const totals = data.totals?.[0] || {};
    const entries = Object.fromEntries(entryRows.map((row) => [row._id, row.count]));
    const decided = (entries.approved || 0) + (entries.denied || 0);
    const counts = new Map((data.trend || []).map((row) => [row._id, row.count]));
    const trend = [];
    for (let day = start.getTime(); day < end.getTime(); day += 86400000) {
      const date = new Date(day + 8 * 3600000).toISOString().slice(0, 10);
      trend.push({ date, count: counts.get(date) || 0 });
    }
    res.set('Cache-Control', 'private, no-store');
    res.json({ from, to, timezone: 'Asia/Manila', generatedAt: now.toISOString(),
      uploads: totals.uploads || 0, activeArtists: totals.artists?.filter(Boolean).length || 0,
      pending: totals.pending || 0, rejected: totals.rejected || 0,
      pendingOverSevenDays: data.backlog?.[0]?.overSevenDays || 0,
      oldestPendingAt: data.backlog?.[0]?.oldest || null,
      approvalRate: decided ? Math.round((entries.approved || 0) / decided * 1000) / 10 : null,
      entries, trend, categories: (data.categories || []).map((row) => ({ category: row._id, count: row.count })),
    });
  } catch (error) { next(error); }
}

module.exports = { analyticsWindow, getAnalytics };

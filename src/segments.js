import { v4 as uuidv4 } from 'uuid';
import sortBy from 'lodash/sortBy';

export const createSegment = ({ start, end, name, tags, segIndex } = {}) => ({
  start,
  end,
  name: name || '',
  segId: uuidv4(),
  segIndex,

  // `tags` is an optional object (key-value). Values must always be string
  // See https://github.com/mifi/lossless-cut/issues/879
  tags: tags != null && typeof tags === 'object'
    ? Object.fromEntries(Object.entries(tags).map(([key, value]) => [key, String(value)]))
    : undefined,
});

// Because segments could have undefined start / end
// (meaning extend to start of timeline or end duration)
export function getSegApparentStart(seg) {
  const time = seg.start;
  return time !== undefined ? time : 0;
}

export const getCleanCutSegments = (cs) => cs.map((seg) => ({
  start: seg.start,
  end: seg.end,
  name: seg.name,
  tags: seg.tags,
}));

export function findSegmentsAtCursor(apparentSegments, currentTime) {
  const indexes = [];
  apparentSegments.forEach((segment, index) => {
    if (segment.start < currentTime && segment.end > currentTime) indexes.push(index);
  });
  return indexes;
}

export const getSegmentTags = (segment) => (segment.tags || {});

export const sortSegments = (segments) => sortBy(segments, 'start');

export function invertSegments(sortedCutSegments, duration) {
  if (sortedCutSegments.length < 1) return undefined;

  const foundOverlap = sortedCutSegments.some((cutSegment, i) => {
    if (i === 0) return false;
    return sortedCutSegments[i - 1].end > cutSegment.start;
  });

  if (foundOverlap) return undefined;

  const ret = [];

  if (sortedCutSegments[0].start > 0) {
    ret.push({
      start: 0,
      end: sortedCutSegments[0].start,
    });
  }

  sortedCutSegments.forEach((cutSegment, i) => {
    if (i === 0) return;
    ret.push({
      start: sortedCutSegments[i - 1].end,
      end: cutSegment.start,
    });
  });

  const last = sortedCutSegments[sortedCutSegments.length - 1];
  if (last.end < duration || duration == null) {
    ret.push({
      start: last.end,
      end: duration,
    });
  }

  // Filter out zero length resulting segments
  // https://github.com/mifi/lossless-cut/issues/909
  return ret.filter(({ start, end }) => end == null || start == null || end > start);
}

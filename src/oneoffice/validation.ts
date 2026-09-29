import type { OneOfficeDiscussionExport } from './types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';
const isNullableString = (value: unknown): value is string | null =>
  value === null || isString(value);
const isNonNegativeInteger = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 0;
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isString);

export function isOneOfficeDiscussionExport(
  value: unknown,
): value is OneOfficeDiscussionExport {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !['1office-dom', '1office-comment-api'].includes(String(value.source))
  ) {
    return false;
  }

  const entity = value.entity;
  const collection = value.collection;
  const comments = value.comments;

  if (
    !isString(value.capturedAt) ||
    !isRecord(entity) ||
    (entity.type !== 'project' && entity.type !== 'task') ||
    !isString(entity.internalId) ||
    !isNullableString(entity.code) ||
    !isString(entity.name) ||
    !isString(entity.url) ||
    !isRecord(collection) ||
    typeof collection.complete !== 'boolean' ||
    !isNonNegativeInteger(collection.loadMoreClicks) ||
    !isNonNegativeInteger(collection.loadedRootCommentCount) ||
    !isNonNegativeInteger(collection.loadedReplyCount) ||
    !(
      collection.expectedRootCommentCount === null ||
      isNonNegativeInteger(collection.expectedRootCommentCount)
    ) ||
    !isStringArray(collection.warnings) ||
    !Array.isArray(comments)
  ) {
    return false;
  }

  return comments.every((comment) => {
    if (
      !isRecord(comment) ||
      !isString(comment.id) ||
      !isNullableString(comment.parentId) ||
      !isString(comment.rootId) ||
      !isNonNegativeInteger(comment.depth) ||
      !isNonNegativeInteger(comment.sourceOrder) ||
      !isNullableString(comment.authorId) ||
      !isString(comment.authorName) ||
      !isString(comment.createdAtRaw) ||
      !isNullableString(comment.createdAtIso) ||
      !isString(comment.contentText) ||
      !Array.isArray(comment.mentions) ||
      !Array.isArray(comment.attachments)
    ) {
      return false;
    }

    const mentionsAreValid = comment.mentions.every(
      (mention) =>
        isRecord(mention) &&
        isNullableString(mention.userId) &&
        isString(mention.displayName),
    );
    const attachmentsAreValid = comment.attachments.every(
      (attachment) =>
        isRecord(attachment) &&
        isNonNegativeInteger(attachment.index) &&
        isString(attachment.name) &&
        isNullableString(attachment.sizeText) &&
        isNullableString(attachment.thumbnailUrl) &&
        typeof attachment.originalDownloadAvailable === 'boolean',
    );

    return mentionsAreValid && attachmentsAreValid;
  });
}

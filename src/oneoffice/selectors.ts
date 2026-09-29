export const ONEOFFICE_SELECTORS = {
  attachment: '.comment-files .comment-file',
  attachmentDescription: '.desc',
  attachmentThumbnail: 'img',
  author: ':scope > .comment-contents > .comment-content > .comment-head > a.userlink',
  authorAvatar: ':scope > .comment-left img.userlink[uid]',
  commentContent: ':scope > .comment-contents > .comment-content > .comment-post',
  discussionRoot: '.cards.comments[comments-id]',
  field: '.detail-field',
  fieldContent: '.detail-field-content',
  fieldLabel: '.detail-field-label',
  loadMore: ':scope > .prev .bt, :scope > .cards-body > .prev .bt',
  mention: 'a.userlink',
  nestedComments: ':scope > .comment-contents > .cards.sub-comments[comments-id]',
  rootComments: ':scope > .cards-body > .comment',
  timestamp:
    ':scope > .comment-contents > .comment-panel > .comment-panel-time span[title]',
} as const;

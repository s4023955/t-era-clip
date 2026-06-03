console.log('T-eraClip content script loaded');

const selectedText = window.getSelection()?.toString().trim();

if (selectedText) {
  console.log('T-eraClip selected text:', selectedText);
}

const chromeApi = typeof globalThis !== 'undefined' ? (globalThis as any).chrome : undefined;

console.log('T-eraClip background worker loaded');

if (chromeApi?.runtime?.onInstalled?.addListener) {
  chromeApi.runtime.onInstalled.addListener(() => {
    console.log('T-eraClip installed or upgraded.');
  });
}

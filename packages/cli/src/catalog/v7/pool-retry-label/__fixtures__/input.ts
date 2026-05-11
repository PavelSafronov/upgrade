if (error.hasErrorLabel('PoolRequstedRetry')) {
  retry();
}
const label = 'PoolRequstedRetry';

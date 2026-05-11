if (error.hasErrorLabel('PoolRequestedRetry')) {
  retry();
}
const label = 'PoolRequestedRetry';

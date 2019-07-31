function calculateFibonacci(nth) {
  if (nth === 0) {
    return 0;
  }
  if (nth === 1) {
    return 1;
  }

  return calculateFibonacci(nth - 1) + calculateFibonacci(nth - 2);
}

module.exports = {
  calculateFibonacci,
};

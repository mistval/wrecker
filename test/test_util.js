function wait(ms) {
  return new Promise((fulfill) => {
    setTimeout(fulfill, ms);
  });
}

module.exports = {
  wait,
};

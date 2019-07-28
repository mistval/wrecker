function wait(ms) {
  return new Promise((fulfill) => {
    setTimeout(fulfill, ms);
  });
}

function echo(text) {
  return text;
}

function exit() {
  process.exit(1);
}

function throwError() {
  throw new Error('errormsg');
}

async function longRunningAddition(args) {
  await wait(500);
  return args.a + args.b;
}

module.exports = {
  echo,
  longRunningAddition,
  exit,
  throwError,
  notAFunction: 5,
};

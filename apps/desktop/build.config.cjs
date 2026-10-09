const build = require('./package.json').build;
module.exports = {
  ...build,
  forceCodeSigning: process.platform === 'win32' && process.env.DATAM8_REQUIRE_SIGNING === '1',
  win: {
    ...build.win,
    signtoolOptions: {
      ...build.win.signtoolOptions,
      ...(process.env.DATAM8_WINDOWS_PUBLISHER ? { publisherName: process.env.DATAM8_WINDOWS_PUBLISHER } : {}),
    },
  },
};

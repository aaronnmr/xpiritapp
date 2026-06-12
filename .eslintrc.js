// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  extends: 'expo',
  overrides: [
    {
      files: ['*.config.js', '.eslintrc.js', 'scripts/**/*.js'],
      env: {
        node: true,
      },
    },
  ],
};

const fs = require("fs");
const path = require("path");

const babelPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "react-native-css-interop",
  "babel.js"
);

if (!fs.existsSync(babelPath)) {
  process.exit(0);
}

const source = fs.readFileSync(babelPath, "utf8");
const patched = source.replace(
  /,\n\s*\/\/ Use this plugin in reanimated 4 and later\n\s*"react-native-worklets\/plugin"/,
  ""
);

if (patched !== source) {
  fs.writeFileSync(babelPath, patched);
  console.log("Patched react-native-css-interop for Expo SDK 51 web preview.");
}

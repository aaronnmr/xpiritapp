const fs = require("fs");
const path = require("path");

const indexPath = path.join(__dirname, "..", "dist", "index.html");

if (!fs.existsSync(indexPath)) {
  throw new Error("dist/index.html was not found. Run expo export before patching web icons.");
}

let html = fs.readFileSync(indexPath, "utf8");

const tags = [
  '<meta name="theme-color" content="#ffffff" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-title" content="Xpirit" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
  '<link rel="icon" type="image/png" href="/favicon.png" />',
  '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />',
  '<link rel="manifest" href="/manifest.webmanifest" />'
];

const missingTags = tags.filter((tag) => !html.includes(tag));

if (missingTags.length) {
  html = html.replace("</head>", `  ${missingTags.join("\n  ")}\n</head>`);
  fs.writeFileSync(indexPath, html);
}

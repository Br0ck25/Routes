const fs = require("fs");
const path = require("path");

const files = [
  { key: "index.html", path: "public/index.html", base64: false },
  { key: "privacy-policy.html", path: "public/privacy-policy.html", base64: false },
  { key: "logo.png", path: "public/logo.png", base64: true },
  { key: "logo-512.png", path: "public/logo-512.png", base64: true },
  { key: "manifest.json", path: "public/manifest.json", base64: false },
  { key: "service-worker.js", path: "public/service-worker.js", base64: false },
  { key: "offline.html", path: "public/offline.html", base64: false }
];

const output = files.map(file => {
  const raw = fs.readFileSync(path.resolve(__dirname, file.path));
  return {
    key: file.key,
    value: file.base64 ? raw.toString("base64") : raw.toString("utf-8"),
    base64: file.base64
  };
});

fs.writeFileSync("kv_upload.json", JSON.stringify(output, null, 2));
console.log("✅ kv_upload.json created.");

/* The `dotenv` package allows us to load environement
 * variables from the `.env` file. Then, we can access them
 * with `process.env.ENV_VAR_NAME`.
 */
require("dotenv").config();
const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const DG_KEY = process.env.DG_KEY;
const DG_SECRET = process.env.DG_SECRET;

if (DG_KEY === undefined || DG_SECRET === undefined) {
  throw "You must define DG_KEY and DG_SECRET in your .env file";
}

// Encode the Deepgram credentials in base64. Will be used to authenticate
// through the Deepgram API.
const DG_CREDENTIALS = Buffer.from(DG_KEY + ":" + DG_SECRET).toString("base64");

const app = express();
let server = http.createServer(app);

/*
 * Basic configuration:
 * - we expose the `/public` folder as a "static" folder, so
 *   browser can directly request js and css files in it.
 * - we send the `/public/index.html` file when the browser requests
 *   the "/" route.
 */
app.use(express.static(__dirname + "/public"));
app.get("/", function (req, res) {
  res.sendFile(`${__dirname}/public/index.html`);
});

const listener = server.listen(process.env.PORT, () =>
  console.log(`Server is running on port ${process.env.PORT}`)
);

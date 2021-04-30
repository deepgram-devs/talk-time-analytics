// @ts-check

require("dotenv").config();
const express = require("express");

const app = express();
const http = require("http");

const DG_KEY = process.env.DG_KEY;
const DG_SECRET = process.env.DG_SECRET;

app.use(express.json());
let server = http.createServer(app);

const CALLBACK_URL = "https://252b5d5b285a.ngrok.io";
const UBER_AUDIO_URL =
  "https://cdn.filesend.jp/private/WNl_J99BHPdLhKhhC7M-EtiTNfMinSOWuYvV5Txt9vyzg-sfLPI_8OsD8dS1qCxM/uber_file_V2.wav";

const DeepgramAPI = require("./dgsdk").DeepgramAPI;

const MY_DEEPGRAM_OPTIONS = DeepgramAPI.diarize().filterProfanity().punctuate();

async function example() {
  const resp = await MY_DEEPGRAM_OPTIONS.withCredentials({
    api_key: DG_KEY,
    api_secret: DG_SECRET,
  }).transcribeUrlWithCallbackUrl({
    audioUrl: UBER_AUDIO_URL,
    callbackUrl: CALLBACK_URL,
  });
  console.log("Deepgram response:");
  if (resp.status === "error") {
    console.log(resp.reason);
  } else {
    console.log(resp.request_id);
  }
}

app.post("/", function (request, response) {
  const decoder = MY_DEEPGRAM_OPTIONS.decoderFromJson();
  console.log("Raw callback body:", request.body);
  const dgResp = decoder(request.body);

  if (dgResp.status === "error") {
    console.log(dgResp.reason);
  } else {
    console.log(
      "Set or speakers:",
      new Set(dgResp.channels[0].words.map((word) => word.speaker))
    );
  }
  response.send("ok");
});

const listener = server.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
  example().then();
});

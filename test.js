require("dotenv").config();

const DG_KEY = process.env.DG_KEY;
const DG_SECRET = process.env.DG_SECRET;

const UBER_AUDIO_URL =
  "https://cdn.filesend.jp/private/rIYL8Z-Zc7ERUNe1ADSF2wJdWMJhODTiwNouI6JvcorqvfHhoWYv0Iq3V-e5Nyvf/uber_file_V2.mp3";

const DeepgramAPI = require("./dgsdk").DeepgramAPI;

async function example() {
  const resp = await DeepgramAPI.withCredentials({
    api_key: DG_KEY,
    api_secret: DG_SECRET,
  }).transcribeUrl(UBER_AUDIO_URL);

  if (resp.status === "error") {
    console.log(resp.reason);
  } else {
    console.log(resp.channels[0].transcript);
  }
}

example();

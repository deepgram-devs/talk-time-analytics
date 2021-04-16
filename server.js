/* The `dotenv` package allows us to load environnement
 * variables from the `.env` file. Then, we can access them
 * with `process.env.ENV_VAR_NAME`.
 */
require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const http = require("http");

const https = require("https"); // used to perform request to Deepgram API
const ejs = require("ejs"); // template engine
const multer = require("multer"); // handle file upload
const fs = require("fs"); // access to the server's file system.

/** Deepgram API key and secret.
 * - See https://developers.deepgram.com/api-reference/speech-recognition-api#operation/createAPIKey
 *   to create the key with cURL or equivalent tool.
 * - Login to https://missioncontrol.deepgram.com/ to create one with a graphical user interface (click on
 *   "View Usage").
 */
const DG_KEY = process.env.DG_KEY;
const DG_SECRET = process.env.DG_SECRET;

if (DG_KEY === undefined || DG_SECRET === undefined) {
  throw "You must define DG_KEY and DG_SECRET in your .env file";
}

// Encode the Deepgram credentials in base64. Will be used to authenticate
// through the Deepgram API.
const DG_CREDENTIALS = Buffer.from(DG_KEY + ":" + DG_SECRET).toString("base64");

const app = express();
app.set("view engine", "ejs"); // initialize "ejs" template engine
let server = http.createServer(app);

const UPLOAD_DIST = ".data/";
const upload = multer({ dest: UPLOAD_DIST }); // initialize file upload handling

if (!fs.existsSync(UPLOAD_DIST)) {
  // if the upload destination folder doesn't exist
  fs.mkdirSync(UPLOAD_DIST); // ... create it!
}

// enable body parsing
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/*
 * Basic configuration:
 * - we expose the `/public` folder as a "static" folder, so
 *   browser can directly request js and css files in it.
 * - we send the `/public/index.html` file when the browser requests
 *   the "/" route.
 */
app.use(express.static(__dirname + "/public"));
app.get("/", (req, res) => {
  res.render("index.ejs");
});

/**
 * Request ASR to Deepgram server.
 * If `contentType == "application/json"`, Deepgram API expects the `payload` to
 * be something like: `{ url: "https://myurl.com/myaudiofile.mp3" }`. The url has to point
 * to an audio file.
 *
 * If `contentType` is NOT "application/json", Deepgram server expects the payload to
 * be raw binary audio file.
 *
 * `cleaning` function is called either when the request is successfully completed
 * or if there are some error during this request.
 * @param {{
 *   res: import("express-serve-static-core").Response<any, Record<string, any>, number>
 * ; filename: string
 * ; contentType: string
 * ; payload: Buffer | string
 * ; cleaning: () => void
 * }} params
 */
function requestDeepgramAPI({ res, filename, contentType, payload, cleaning }) {
  const options = {
    host: "brain.deepgram.com",
    /** You can add options as parameters in the URL, see the docs:
     * https://developers.deepgram.com/api-reference/speech-recognition-api#operation/transcribeStreamingAudio
     */
    path: "/v2/listen?punctuate=true&diarize=true",
    method: "POST",
    headers: {
      "Content-Type": contentType,
      Authorization: "Basic " + DG_CREDENTIALS,
    },
  };
  const dgReq = https.request(options, (dgRes) => {
    // we accumulate data in `dgResContent` as it
    // comes from Deepgram API
    let dgResContent = "";
    dgRes.on("data", (chunk) => {
      dgResContent += chunk;
    });

    dgRes.on("end", () => {
      // When we have the complete answer from Deepgram API,
      // we compute time per speaker, then render it with
      // the template.
      const dgResJson = JSON.parse(dgResContent);
      const speakers = computeSpeakingTime(dgResJson);
      res.render("analytics.ejs", {
        speakers,
        filename,
      });
      cleaning();
    });
    dgRes.on("error", (err) => {
      error(res, err);
      cleaning();
    });
  });

  dgReq.on("error", (err) => {
    error(res, err);
    cleaning();
  });
  dgReq.write(payload);
  dgReq.end();
}

/**
 * @param {import("express-serve-static-core").Response<any, Record<string, any>, number>} res
 * @param {Error} error
 */
function error(res, error) {
  console.error(error);
  res.status(500).send("Something went wrong :/");
}

/**
 * Handle file upload. The file will be stored on the server's disk
 * before be sent to Deepgram API.
 */
app.post("/analyze-file", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.send({
        status: "error",
        message: "No file uploaded",
      });
    } else {
      const file = req.file;

      // We request file content...
      fs.readFile(req.file.path, (err, data) => {
        if (err) {
          error(res, err);
          return;
        }
        // When we have the file content, we forward
        // it to Deepgram API.
        requestDeepgramAPI({
          res,
          filename: req.file.originalname,
          contentType: req.file.mimetype,
          payload: data,
          cleaning: () => fs.unlinkSync(file.path),
        });
      });
    }
  } catch (err) {
    error(res, err);
  }
});

app.post("/analyze-url", async (req, res) => {
  try {
    if (!req.body.url) {
      res.send({
        status: "error",
        message: "No url provided",
      });
    } else {
      const url = req.body.url;
      requestDeepgramAPI({
        res,
        filename: url,
        contentType: "application/json",
        payload: JSON.stringify({ url }),
        cleaning: () => {},
      });
    }
  } catch (err) {
    error(res, err);
  }
});

/**
 * A Deepgram transcript consists of an array of word. Among other data,
 * we find the `start` and `end` timing describing when this word is pronounced.
 *
 * If we provide the `diarize=true` option, we also have a `speaker` field containing
 * the speaker id (integer, starting at 0).
 *
 * @typedef {{speaker: number; start:number; end:number; }} Word */

/**
 * Returns an array of speaking time. The number at the index `i` is the
 * speaking time of the speaker `i`.
 *
 * @param {{ results: { channels: Array<{ alternatives: Array<{ words: Array<Word> }> }>}} } transcript
 * @returns { Array<number>}
 */
function computeSpeakingTime(transcript) {
  const words = transcript.results.channels[0].alternatives[0].words;

  if (words.length === 0) {
    return [];
  }

  /**
   * `timePerSpeaker` tracks speaker time. Keys
   *  are speaker id, values are speaking time.
   * @type {Map<number, number>} */
  const timePerSpeaker = new Map();
  let wordAtLastSpeakerChange = words.shift();
  for (const word of words) {
    // If the speaker changes at this word
    if (wordAtLastSpeakerChange.speaker !== word.speaker) {
      addSpeakingTime(
        wordAtLastSpeakerChange.speaker,
        word.end - wordAtLastSpeakerChange.start,
        timePerSpeaker
      );
      wordAtLastSpeakerChange = word;
    }
  }

  const lastWord = words[words.length - 1];
  addSpeakingTime(
    wordAtLastSpeakerChange.speaker,
    lastWord.end - wordAtLastSpeakerChange.start,
    timePerSpeaker
  );

  return (
    // converting the Map into an array
    [...timePerSpeaker.entries()]
      // sorting by speaker id (keys of the Map)
      .sort((entryA, entryB) => entryA[0] - entryB[0])
      // only keep the speaking times (the values of the Map)
      .map((entry) => entry[1])
  );
}

/**
 * @param {number} speaker
 * @param {number} duration
 * @param {Map<number, number>} timePerSpeaker
 */
function addSpeakingTime(speaker, duration, timePerSpeaker) {
  const currentSpeakerDuration = timePerSpeaker.get(speaker) || 0;
  timePerSpeaker.set(speaker, currentSpeakerDuration + duration);
}

const listener = server.listen(process.env.PORT, () =>
  console.log(`Server is running on port ${process.env.PORT}`)
);

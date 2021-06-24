/* The `dotenv` package allows us to load environnement
 * variables from the `.env` file. Then, we can access them
 * with `process.env.ENV_VAR_NAME`.
 */
require("dotenv").config();

const express = require("express");
const http = require("http");

const https = require("https"); // used to perform request to Deepgram API
const ejs = require("ejs"); // template engine
const multer = require("multer"); // handle file upload
const fs = require("fs"); // access to the server's file system.

const DG_KEY = process.env.DG_KEY;

if (DG_KEY === undefined) {
  throw "You must define DG_KEY in your .env file";
}

const app = express();
app.set("view engine", "ejs"); // initialize "ejs" template engine
let server = http.createServer(app);

// We use `/tmp` to store the file sent by users because there are no size
// limit on Glitch in this directory. On Glitch, those files will be removed
// at every application restart. You might want using another folder and cleaning
// strategy for a real app.
const UPLOAD_DIST = "/tmp/uploaded/";
const upload = multer({ dest: UPLOAD_DIST }); // initialize file upload handling
if (!fs.existsSync(UPLOAD_DIST)) {
  // if the upload destination folder doesn't exist
  fs.mkdirSync(UPLOAD_DIST); // ... create it!
}

// We expose the uploaded files so we can play them on the `analytics.ejs` result
// page.
app.get("/uploaded-file/:filename", (req, res) => {
  const filename = req.params.filename;
  // Prevent accessing another folder than `UPLOAD_DIST`.
  if (filename.indexOf("/") !== -1) {
    res.status(400).send("You cannot access this resource.");
  }
  const completePath = UPLOAD_DIST + filename;
  if (!fs.existsSync(completePath)) {
    res.status(404).send("This resource doesn't exist");
  } else {
    res.sendFile(completePath);
  }
});

// enable body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
 * Request ASR from Deepgram server.
 * If `contentType == "application/json"`, Deepgram API expects the `payload` to
 * be something like: `{ url: "https://myurl.com/myaudiofile.mp3" }`. The url has to point
 * to an audio file.
 *
 * If `contentType` is NOT "application/json", Deepgram server expects the payload to
 * be raw binary audio file.
 *
 * @param {{
 *   res: import("express-serve-static-core").Response<any, Record<string, any>, number>
 * ; filename: string
 * ; fileUrl : string
 * ; contentType: string
 * ; payload: Buffer | string

 * }} params
 */
function requestDeepgramAPI({ res, filename, fileUrl, contentType, payload }) {
  const options = {
    host: "dev.brain.deepgram.com",
    /** You can add options as parameters in the URL, see the docs:
     * https://developers.deepgram.com/api-reference/speech-recognition-api#operation/transcribeStreamingAudio
     */
    path: "/v1/listen?punctuate=true&diarize=true",
    port: 8090,
    method: "POST",
    headers: {
      "Content-Type": contentType,
      Authorization: "token " + DG_KEY,
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
      if (dgResJson.error) {
        error(res, dgResJson);
        return;
      }

      const speakers = computeSpeakingTime(dgResJson);
      res.render("analytics.ejs", {
        speakers,
        filename,
        fileUrl,
      });
    });
    dgRes.on("error", (err) => {
      error(res, err);
    });
  });

  dgReq.on("error", (err) => {
    error(res, err);
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
      const filePath = file.path.split("/");
      const fileUrl = "/uploaded-file/" + filePath[filePath.length - 1];
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
          filename: file.originalname,
          fileUrl,
          contentType: file.mimetype,
          payload: data,
        });
      });
    }
  } catch (err) {
    error(res, err);
  }
});

/**
 * Handle file upload from URL.
 */
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
        fileUrl: url,
        contentType: "application/json",
        payload: JSON.stringify({ url }),
      });
    }
  } catch (err) {
    error(res, err);
  }
});

// Mock analyze results
app.get("/analyze-test", async (_, res) => {
  res.render("analytics.ejs", {
    speakers: [12.5, 143.98],
    filename: "MyFile.mp3",
  });
});

/**
 * Each Deepgram response consists of a transcript, a confidence score, and a word array.
 * In that array, we can see the `start` and `end` timings detailing when each word is said.
 *
 * If we provide the `diarize=true` option, the response will contain a `speaker` field with
 * an associated speaker id (integer, starting at 0) for each word.
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
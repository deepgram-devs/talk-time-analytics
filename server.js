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
const Deepgram = require("./dgsdk");
const DeepgramAPI = Deepgram.DeepgramAPI;
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
 * @param {import("express-serve-static-core").Response<any, Record<string, any>, number>} res
 * @param {String} error
 */
function error(res, error) {
  console.error(error);
  res.status(500).send("Something went wrong :/");
}

const DG_EXECUTOR = DeepgramAPI.diarize()
  .punctuate()
  .withCredentials({ api_key: DG_KEY, api_secret: DG_SECRET });

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
      fs.readFile(req.file.path, async (err, data) => {
        if (err) {
          error(res, JSON.stringify(err));
          return;
        }
        // When we have the file content, we forward
        // it to Deepgram API.
        const dgResponse = await DG_EXECUTOR.transcribeBuffer({
          buffer: data,
          mimetype: file.mimetype,
        });
        if (dgResponse.status === "error") {
          error(res, dgResponse.reason);
        } else {
          renderAnalytics(res, {
            filename: file.originalname,
            fileUrl,
            words: dgResponse.channels[0].words,
          });
        }
      });
    }
  } catch (err) {}
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
      const dgResponse = await DG_EXECUTOR.transcribeUrl(url);
      if (dgResponse.status === "error") {
        error(res, dgResponse.reason);
      } else {
        renderAnalytics(res, {
          filename: url,
          fileUrl: url,
          words: dgResponse.channels[0].words,
        });
      }
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
/
/**
 * Returns an array of speaking time. The number at the index `i` is the
 * speaking time of the speaker `i`.
 *
 * @param {   Array<Deepgram.DGWord<"diarized", Deepgram.Punctuation>> } words
 * @returns { Array<number>}
 */
function computeSpeakingTime(words) {
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

/**
 * @param {import("express-serve-static-core").Response<any, Record<string, any>, number>} res
 * @param { {filename:string, fileUrl: string, words: Array<Deepgram.DGWord<"diarized", Deepgram.Punctuation>>}} words
 */
function renderAnalytics(res, { filename, fileUrl, words }) {
  const speakers = computeSpeakingTime(words);
  res.render("analytics.ejs", {
    speakers,
    filename,
    fileUrl,
  });
}

const listener = server.listen(process.env.PORT, () =>
  console.log(`Server is running on port ${process.env.PORT}`)
);

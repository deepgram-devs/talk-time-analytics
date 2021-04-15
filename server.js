/* The `dotenv` package allows us to load environement
 * variables from the `.env` file. Then, we can access them
 * with `process.env.ENV_VAR_NAME`.
 */
require("dotenv").config();
const express = require("express");
const http = require("http");
const https = require("https");
const ejs = require("ejs");
const multer = require("multer");
const bodyParser = require("body-parser");
const fs = require("fs");
const DG_KEY = process.env.DG_KEY;
const DG_SECRET = process.env.DG_SECRET;

if (DG_KEY === undefined || DG_SECRET === undefined) {
  throw "You must define DG_KEY and DG_SECRET in your .env file";
}

// Encode the Deepgram credentials in base64. Will be used to authenticate
// through the Deepgram API.
const DG_CREDENTIALS = Buffer.from(DG_KEY + ":" + DG_SECRET).toString("base64");

const app = express();
app.set("view engine", "ejs");
let server = http.createServer(app);

const UPLOAD_DIST = ".data/";
const upload = multer({ dest: UPLOAD_DIST });
if (!fs.existsSync(UPLOAD_DIST)) {
  fs.mkdirSync(UPLOAD_DIST);
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

app.post("/analyze-file", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.send({
        status: "error",
        message: "No file uploaded",
      });
    } else {
      const file = req.file;

      fs.readFile(req.file.path, function (err, data) {
        if (err) throw err;
        const options = {
          host: "brain.deepgram.com",
          path: "/v2/listen?punctuate=true&diarize=true",
          method: "POST",
          headers: {
            "Content-Type": req.file.mimetype,
            Authorization: "Basic " + DG_CREDENTIALS,
          },
        };
        const dgReq = https.request(options, (dgRes) => {
          let dgResContent = "";
          dgRes.on("data", (chunk) => {
            dgResContent += chunk;
          });
          dgRes.on("end", () => {
            const dgResJson = JSON.parse(dgResContent);
            const speakers = computeSpeakingTime(dgResJson);
            res.render("analytics.ejs", {
              speakers,
              filename: req.file.originalname,
            });
            fs.unlinkSync(file.path);
          });
          dgRes.on("error", () => fs.unlinkSync(file.path));
        });

        dgReq.on("error", function (err) {
          console.log(err);
          res.status(500).send("Something went wrong :/");
          fs.unlinkSync(file.path);
        });
        // Write the audio data in the request body.
        dgReq.write(data);
        dgReq.end();
      });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send("something went wrong");
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

      const options = {
        host: "brain.deepgram.com",
        path: "/v2/listen?punctuate=true&diarize=true",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Basic " + DG_CREDENTIALS,
        },
      };
      const dgReq = https.request(options, (dgRes) => {
        let dgResContent = "";
        dgRes.on("data", (chunk) => {
          dgResContent += chunk;
        });
        dgRes.on("end", () => {
          console.log(dgResContent);
          const dgResJson = JSON.parse(dgResContent);
          const speakers = computeSpeakingTime(dgResJson);
          res.render("analytics.ejs", {
            speakers,
            filename: url,
          });
        });
        dgRes.on("error", () => {
          res.send("Something went wrong :/");
        });
      });

      dgReq.on("error", function (err) {
        console.log(err);
        res.status(500).send("Something went wrong :/");
      });
      // Write the file URL in the request body.
      dgReq.write(JSON.stringify({ url }));
      dgReq.end();
    }
  } catch (err) {
    console.log(err);
    res.status(500).send("something went wrong");
  }
});

/** @typedef {{speaker: number; start:number; end:number; }} Word */
/**
 * @param {{ results: { channels: Array<{ alternatives: Array<{ words: Array<Word> }> }>}} } transcript
 * @returns { Array<number>}
 */
function computeSpeakingTime(transcript) {
  const words = transcript.results.channels[0].alternatives[0].words;
  if (words.length === 0) {
    return [];
  }

  /** @type {Map<Number, Number>} */
  const timePerSpeaker = new Map();
  let lastSpeakerChange = words.shift();
  for (const word of words) {
    if (lastSpeakerChange.speaker !== word.speaker) {
      addSpeakingTime(
        lastSpeakerChange.speaker,
        word.end - lastSpeakerChange.start,
        timePerSpeaker
      );
      lastSpeakerChange = word;
    }
  }

  const lastWord = words[words.length - 1];
  addSpeakingTime(
    lastSpeakerChange.speaker,
    lastWord.end - lastSpeakerChange.start,
    timePerSpeaker
  );

  return [...timePerSpeaker.entries()]
    .sort((entryA, entryB) => entryA[0] - entryB[0])
    .map((entry) => entry[1]);
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

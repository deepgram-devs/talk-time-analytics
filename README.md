# What is this app for?

This app aims to demonstrate how to use Deepgram API to compute
talk time per speaker.

We use [Chart.js](https://chartjs.org/) to render those data.

**WARNING**: This is an example application only designed for demoing. We
strongly discourage direct use of this code in production environnement.

# How can I deploy it?

_Prerequisites: Deepgram account and API Key._

You can "remix" this application on Glitch:

1. Create an API key in Deepgram, note down the secret.
2. Replace `INSERT_KEY_HERE` and `INSERT_SECRET_HERE`
   with this API key and secret in the following URL:
   > https://glitch.com/edit/#!/remix/dg-talk-time-analytics?PORT=3000&DG_KEY=INSERT_KEY_HERE&DG_SECRET=INSERT_SECRET_HERE

When accessing this URL in your browser, the project will be forked and deployed. Glitch comes with
an online editor so you'll have all the needed tools to play with your own app instance!

# Can I run it on my own computer?

_Prerequisites: Deepgram account and API Key._

Yes, of course! First, copy-paste those lines in your terminal:

```bash
# Clone this repo
git clone https://github.com/deepgram/talk-time-analytics.git
# move to the created directory
cd talk-time-analytics
```

Replace `INSERT_KEY_HERE` and `INSERT_SECRET_HERE` with you API key and secret
in the following snippet, then save this snippet as a file named `.env`
(note that this is bash-like file, so spaces around `=` are not allowed).

```bash
PORT=3000
DG_KEY=INSERT_KEY_HERE
DG_SECRET=INSERT_SECRET_HERE
```

Then, install the dependencies and start the server:

```bash
npm install
npm start
```

# How does it work?

The workflow is the following:

- the user requests the `/` URL, so the server (`server.js`) serves the
  `views/index.ejs` file to the user;
- if the user fills up the "FROM AN URL" form, the server will send a
  request to Deepgram API, with `{ "url": "<whatever the user sent>".}`;
- if the user sends up a file from his device, the file is sent to the
  server and then forwarded to Deepgram API;
- in both cases, when Deepgram API answers we compute the speaking time
  for each speaker and use the `views/analytics.ejs` template to display
  results.

_Note:_ we could directly request Deepgram API from the browser, _BUT_ this would
ask you disclosing your Deepgram API key to the user. Think about it twice
before choosing this option.

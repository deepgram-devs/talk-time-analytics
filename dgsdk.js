"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listen = void 0;
var https_1 = require("https");
var defaultOptions = {
    punctuate: false,
    diarize: false,
};
function buildDeepgramAPIRoute(options) {
    var queryParams = [];
    if (options.punctuate) {
        queryParams.push("punctuate=true");
    }
    if (options.diarize) {
        queryParams.push("diarize=true");
    }
    return ("/v2/listen" + (queryParams.length === 0 ? "" : "?" + queryParams.join("&")));
}
function listen(_a) {
    var credentials = _a.credentials, source = _a.source, options = _a.options;
    var credentialsB64 = Buffer.from(credentials.api_key + ":" + credentials.api_secret).toString("base64");
    var allOptions = __assign(__assign({}, defaultOptions), options);
    var requestOptions = {
        host: "brain.deepgram.com",
        /** You can add options as parameters in the URL, see the docs:
         * https://developers.deepgram.com/api-reference/speech-recognition-api#operation/transcribeStreamingAudio
         */
        path: buildDeepgramAPIRoute(allOptions),
        method: "POST",
        headers: {
            "Content-Type": source.kind === "url" ? "application/json" : source.mimetype,
            Authorization: "Basic " + credentialsB64,
        },
    };
    var payload = source.kind === "url" ? source.url : source.buffer;
    return new Promise(function (resolve, _) {
        var httpRequest = https_1.request(requestOptions, function (dgRes) {
            // we accumulate data in `dgResContent` as it
            // comes from Deepgram API
            var dgResContent = "";
            dgRes.on("data", function (chunk) {
                dgResContent += chunk;
            });
            dgRes.on("end", function () {
                // When we have the complete answer from Deepgram API,
                // we can resolve the promise
                var dgResJson = JSON.parse(dgResContent);
                if (dgResJson.error) {
                    resolve({ kind: "error", reason: dgResContent });
                }
                else {
                    resolve(__assign({ kind: "success" }, dgResJson));
                }
            });
            dgRes.on("error", function (err) {
                resolve({ kind: "error", reason: JSON.stringify(err) });
            });
        });
        httpRequest.on("error", function (err) {
            resolve({ kind: "error", reason: JSON.stringify(err) });
        });
        httpRequest.write(payload);
        httpRequest.end();
    });
}
exports.listen = listen;

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
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeepgramAPI = void 0;
var https_1 = require("https");
function buildAPIRoute(options) {
    var queryParams = [];
    if (options.punctuation === "punctuated") {
        queryParams.push("punctuate=true");
    }
    if (options.diarization === "diarized") {
        queryParams.push("diarize=true");
    }
    if (options.alternativesCount > 1) {
        queryParams.push("alternatives=" + options.alternativesCount);
    }
    if (options.profanityFilter) {
        queryParams.push("profanity_filter=true");
    }
    if (options.numbersRedaction) {
        queryParams.push("redact=numbers");
    }
    if (options.SSNRedaction) {
        queryParams.push("redact=ssn");
    }
    if (options.PCIRedaction) {
        queryParams.push("redact=pci");
    }
    for (var _i = 0, _a = options.keywords; _i < _a.length; _i++) {
        var keyword = _a[_i];
        if (typeof keyword === "string") {
            queryParams.push("keywords=" + encodeURIComponent(keyword));
        }
        else {
            queryParams.push("keywords=" + encodeURIComponent(keyword.word) + ":" + keyword.boost);
        }
    }
    for (var _b = 0, _c = options.searchedTerms; _b < _c.length; _b++) {
        var term = _c[_b];
        queryParams.push("search=" + encodeURIComponent(term));
    }
    if (options.callbackUrl !== null) {
        queryParams.push("callback=" + encodeURIComponent(options.callbackUrl));
    }
    return ("/v2/listen" + (queryParams.length === 0 ? "" : "?" + queryParams.join("&")));
}
var DGOptions = /** @class */ (function () {
    function DGOptions(options) {
        this.options = options;
    }
    /**
     * Assign a speaker number starting at 0 to each word in the transcript.
     * In the response, add a `speaker: number` field to the `DGWordBase` type.
     */
    DGOptions.prototype.diarize = function () {
        return new DGOptions(__assign(__assign({}, this.options), { diarization: "diarized" }));
    };
    /**
     * Add punctuation and capitalization to the transcript.
     * In the response, add a `punctuated_word: string` field to the `DGWordBase` type.
     */
    DGOptions.prototype.punctuate = function () {
        return new DGOptions(__assign(__assign({}, this.options), { punctuation: "punctuated" }));
    };
    /**
     * Maximum number of transcript alternatives to return. Just like a human listener,
     * Deepgram can provide multiple possible interpretations of what it hears
     * (defaults to 1 if not set).
     *
     * In the response, turn:
     * ```
     * {
     *   metadata: {...},
     *   channels: [{ words: [...], search: [...], ... }],
     * }
     * ```
     * into:
     * ```
     * {
     *   metadata: {...},
     *   channels: [{
     *        search: [...],
     *        alternatives:[{ words: [...], ... }]
     *    }],
     * }
     * ```
     */
    DGOptions.prototype.setAlternativesNumber = function (count) {
        return new DGOptions(__assign(__assign({}, this.options), { alternativesCount: Math.max(Math.round(count), 1), alternativesSet: true }));
    };
    /**
     * Remove profanity from the transcript.
     */
    DGOptions.prototype.filterProfanity = function () {
        return new DGOptions(__assign(__assign({}, this.options), { profanityFilter: true }));
    };
    /**
     *  Redact sensitive credit card information, including credit card number, expiration date,
     *  and CVV, replacing redacted content with asterisks (*).
     *
     *  Can be associated with other `redact*` options.
     */
    DGOptions.prototype.readactPCI = function () {
        return new DGOptions(__assign(__assign({}, this.options), { PCIRedaction: true }));
    };
    /**
     *  Aggressively redacts strings of numerals, replacing redacted content with asterisks (*).
     *
     *  Can be associated with other `redact*` options.
     */
    DGOptions.prototype.readactNumbers = function () {
        return new DGOptions(__assign(__assign({}, this.options), { numbersRedaction: true }));
    };
    /**
     *  Redacts social security numbers, replacing redacted content with asterisks (*).
     *
     *  Can be associated with other `redact*` options.
     */
    DGOptions.prototype.readactSSN = function () {
        return new DGOptions(__assign(__assign({}, this.options), { SSNRedaction: true }));
    };
    /**
     * Keywords to which the model should pay particular attention to boosting or
     * suppressing to  help it understand context. Just like a human listener,
     * Deepgram can better understand mumbled, distorted, or otherwise
     *  hard-to-decipher speech when it knows the context of the conversation.
     *
     * To learn more about the most effective way to use keywords and recognize
     * context in your transcript, see our Keyword Boosting guide:
     * https://developers.deepgram.com/guides/boosting-keywords
     */
    DGOptions.prototype.addKeywords = function (keywords) {
        return new DGOptions(__assign(__assign({}, this.options), { keywords: __spreadArray(__spreadArray([], this.options.keywords), keywords) }));
    };
    /**
     * Terms or phrases to search for in the submitted audio. Deepgram searches
     * for acoustic patterns in audio rather than text patterns in transcripts
     * because we have noticed that acoustic pattern matching is more performant.
     *
     * Example:
     * ```js
     * const DeepgramAPI = require("deepgram").DeepgramAPI;
     *
     * async function example() {
     *   const resp = await DeepgramAPI
     *       .addSearchTerms(["Hello world", "Bazinga"])
     *       .withCredentials(DG_CREDS)
     *       .transcribeUrl("http//site.com/my-audio-file.mp3");
     *
     *   if (resp.status === "error") {
     *       console.log(resp.reason);
     *   } else {
     *       const search = resp.channels[0].search;
     *       // The "Hello world" results:
     *       console.log(search[0].query, search[0].hits);
     *       // The "Bazinga" results:
     *       console.log(search[1].query, search[1].hits);
     *   }
     * }
     * ```
     */
    DGOptions.prototype.addSearchTerms = function (terms) {
        return new DGOptions(__assign(__assign({}, this.options), { searchedTerms: __spreadArray(__spreadArray([], this.options.searchedTerms), terms), searchSet: true }));
    };
    /**
     * Build the URL based on the options to request the API.
     *
     * You can use this route to manually perform the
     * request to Deepgram API.
     *
     * Note that with `.withCredentials(...)` you'll be able to
     * perform the query and have type information about the response.
     *
     * Example:
     * ```js
     * const DeepgramAPI = require("deepgram").DeepgramAPI;
     *
     * const route = DeepgramAPI.diarize().punctuate().buildURL();
     *
     * // You of course can use any lib you want to perform the HTTP request.
     * axios.get(route).then(response => {
     *     // ...
     *     // deal with the response
     *     // ..
     * });
     * ```
     *
     */
    DGOptions.prototype.buildURL = function () {
        return "https://" + this.options.host + buildAPIRoute(this.options);
    };
    DGOptions.prototype.decoderFromString = function () {
        var _this = this;
        return function (deepgramAPIResp) {
            return decodeApiResponseFromString(_this.options, deepgramAPIResp);
        };
    };
    DGOptions.prototype.decoderFromJson = function () {
        var _this = this;
        return function (deepgramAPIRespJson) {
            return decodeApiResponseFromJson(_this.options, deepgramAPIRespJson);
        };
    };
    DGOptions.prototype.withCredentials = function (credentials) {
        return new DGExectuor(this.options, credentials.api_key, credentials.api_secret);
    };
    return DGOptions;
}());
var DGExectuor = /** @class */ (function () {
    function DGExectuor(options, api_key, api_secret) {
        this.options = options;
        this.api_key = api_key;
        this.api_secret = api_secret;
    }
    DGExectuor.prototype.transcribeUrl = function (url) {
        return listen({
            api_key: this.api_key,
            api_secret: this.api_secret,
            options: this.options,
            source: { kind: "url", url: url },
        });
    };
    DGExectuor.prototype.transcribeUrlWithCallbackUrl = function (_a) {
        var audioUrl = _a.audioUrl, callbackUrl = _a.callbackUrl;
        return listenWithCallbackUrl({
            api_key: this.api_key,
            api_secret: this.api_secret,
            options: this.options,
            source: { kind: "url", url: audioUrl },
            callbackUrl: callbackUrl,
        });
    };
    DGExectuor.prototype.transcribeBuffer = function (_a) {
        var buffer = _a.buffer, mimetype = _a.mimetype;
        return listen({
            api_key: this.api_key,
            api_secret: this.api_secret,
            options: this.options,
            source: { kind: "buffer", buffer: buffer, mimetype: mimetype },
        });
    };
    return DGExectuor;
}());
/**
 * Object configuring a request to Deepgram API.
 *
 * You'll need Deepgram API key and secret to actually perform
 * the request. Note that you can also only use this object to build
 * the URL and perform the request yourself (see the `.buildURL()` method).
 *
 * # Example
 * ```js
 * const DeepgramAPI = require("deepgram").DeepgramAPI;
 *
 * async function example() {
 *   const resp = await DeepgramAPI
 *       .withCredentials({api_key: DG_KEY, api_secret: DG_SECRET})
 *       .transcribeUrl("http//site.com/my-audio-file.mp3");
 *
 *   if (resp.status === "error") {
 *       console.log(resp.reason);
 *   } else {
 *       console.log(resp.channels[0].transcript);
 *   }
 * }
 *
 * example();
 * ```
 *
 * # Example with callback url
 * If you would like your submitted audio to be processed asynchronously, you can use
 * `transcribeUrlWithCallbackUrl`. In this case, Deepgram API will immediately respond
 * with a `request_id`. When it has finished analyzing the audio, it will send a POST
 * request to the provided URL with an appropriate HTTP status code.
 *
 * > Notes:
 * >  - You may embed basic authentication credentials in the callback URL.
 * >  - Only ports 80, 443, 8080, and 8443 can be used for callbacks.
 *
 * ```js
 * async function example() {
 *   const resp = await Deepgram.withCredentials({
 *     api_key: DG_KEY,
 *     api_secret: DG_SECRET,
 *   }).transcribeUrlWithCallbackUrl({
 *     audioUrl: UBER_AUDIO_URL,
 *     callbackUrl: "http://site.com/blah",
 *   });
 *
 *   if (resp.status === "error") {
 *     console.log(resp.reason);
 *   } else {
 *     console.log(resp.request_id);
 *   }
 * }
 *
 * example();
 * ```
 */
exports.DeepgramAPI = new DGOptions({
    punctuation: "non-punctuated",
    diarization: "non-diarized",
    alternativesCount: 1,
    alternativesSet: false,
    profanityFilter: false,
    PCIRedaction: false,
    numbersRedaction: false,
    SSNRedaction: false,
    keywords: [],
    searchedTerms: [],
    searchSet: false,
    host: "brain.deepgram.com",
    callbackUrl: null,
});
function listen(_a) {
    var api_key = _a.api_key, api_secret = _a.api_secret, source = _a.source, options = _a.options;
    var credentialsB64 = Buffer.from(api_key + ":" + api_secret).toString("base64");
    var requestOptions = {
        host: "brain.deepgram.com",
        /** You can add options as parameters in the URL, see the docs:
         * https://developers.deepgram.com/api-reference/speech-recognition-api#operation/transcribeStreamingAudio
         */
        path: buildAPIRoute(options),
        method: "POST",
        headers: {
            "Content-Type": source.kind === "url" ? "application/json" : source.mimetype,
            Authorization: "Basic " + credentialsB64,
        },
    };
    var payload = source.kind === "url" ? JSON.stringify({ url: source.url }) : source.buffer;
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
                resolve(decodeApiResponseFromString(options, dgResContent));
            });
            dgRes.on("error", function (err) {
                resolve({ status: "error", reason: JSON.stringify(err) });
            });
        });
        httpRequest.on("error", function (err) {
            resolve({ status: "error", reason: JSON.stringify(err) });
        });
        httpRequest.write(payload);
        httpRequest.end();
    });
}
function decodeApiResponseFromString(options, dgRes) {
    var dgResJson = JSON.parse(dgRes);
    return decodeApiResponseFromJson(options, dgResJson);
}
function decodeApiResponseFromJson(options, dgResJson) {
    if (dgResJson.error) {
        return { status: "error", reason: JSON.stringify(dgResJson) };
    }
    else {
        return {
            status: "success",
            metadata: dgResJson.metadata,
            channels: options.alternativesSet
                ? dgResJson.results.channels
                : dgResJson.results.channels.map(function (channel) {
                    return options.searchSet
                        ? __assign({ search: channel.search }, channel.alternatives[0]) : channel.alternatives[0];
                }),
        };
    }
}
function listenWithCallbackUrl(_a) {
    var api_key = _a.api_key, api_secret = _a.api_secret, source = _a.source, options = _a.options, callbackUrl = _a.callbackUrl;
    var credentialsB64 = Buffer.from(api_key + ":" + api_secret).toString("base64");
    var requestOptions = {
        host: "brain.deepgram.com",
        path: buildAPIRoute(__assign(__assign({}, options), { callbackUrl: callbackUrl })),
        method: "POST",
        headers: {
            "Content-Type": source.kind === "url" ? "application/json" : source.mimetype,
            Authorization: "Basic " + credentialsB64,
        },
    };
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
                    resolve({ status: "error", reason: dgResContent });
                }
                else {
                    resolve({
                        status: "success",
                        request_id: dgResJson.request_id,
                    });
                }
            });
            dgRes.on("error", function (err) {
                resolve({ status: "error", reason: JSON.stringify(err) });
            });
        });
        httpRequest.on("error", function (err) {
            resolve({ status: "error", reason: JSON.stringify(err) });
        });
        var payload = source.kind === "url"
            ? JSON.stringify({ url: source.url })
            : source.buffer;
        httpRequest.write(payload);
        httpRequest.end();
    });
}

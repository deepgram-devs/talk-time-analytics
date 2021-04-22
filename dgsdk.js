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
    if (options.numbersReadaction) {
        queryParams.push("redact=numbers");
    }
    if (options.SSNReadaction) {
        queryParams.push("redact=ssn");
    }
    if (options.PCIReadaction) {
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
    return ("/v2/listen" + (queryParams.length === 0 ? "" : "?" + queryParams.join("&")));
}
var DGOptions = /** @class */ (function () {
    function DGOptions(options) {
        this.options = options;
    }
    DGOptions.prototype.diarize = function () {
        return new DGOptions(__assign(__assign({}, this.options), { diarization: "diarized" }));
    };
    DGOptions.prototype.punctuate = function () {
        return new DGOptions(__assign(__assign({}, this.options), { punctuation: "punctuated" }));
    };
    DGOptions.prototype.setAlternativesNumber = function (count) {
        return new DGOptions(__assign(__assign({}, this.options), { alternativesCount: Math.max(Math.round(count), 1), alternativesSet: true }));
    };
    DGOptions.prototype.filterProfanity = function () {
        return new DGOptions(__assign(__assign({}, this.options), { profanityFilter: true }));
    };
    DGOptions.prototype.readactPCI = function () {
        return new DGOptions(__assign(__assign({}, this.options), { PCIReadaction: true }));
    };
    DGOptions.prototype.readactNumbers = function () {
        return new DGOptions(__assign(__assign({}, this.options), { numbersReadaction: true }));
    };
    DGOptions.prototype.readactSSN = function () {
        return new DGOptions(__assign(__assign({}, this.options), { SSNReadaction: true }));
    };
    DGOptions.prototype.addKeywords = function (keywords) {
        return new DGOptions(__assign(__assign({}, this.options), { keywords: __spreadArray(__spreadArray([], this.options.keywords), keywords) }));
    };
    DGOptions.prototype.addSearchTerms = function (terms) {
        return new DGOptions(__assign(__assign({}, this.options), { searchedTerms: __spreadArray(__spreadArray([], this.options.searchedTerms), terms), searchSet: true }));
    };
    DGOptions.prototype.buildAPIRoute = function () {
        return buildAPIRoute(this.options);
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
exports.DeepgramAPI = new DGOptions({
    punctuation: "non-punctuated",
    diarization: "non-diarized",
    alternativesCount: 1,
    alternativesSet: false,
    profanityFilter: false,
    PCIReadaction: false,
    numbersReadaction: false,
    SSNReadaction: false,
    keywords: [],
    searchedTerms: [],
    searchSet: false,
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
                var dgResJson = JSON.parse(dgResContent);
                if (dgResJson.error) {
                    resolve({ status: "error", reason: dgResContent });
                }
                else {
                    console.log(dgResJson.results.channels[0]);
                    resolve({
                        status: "success",
                        metadata: dgResJson.metadata,
                        channels: options.alternativesSet
                            ? dgResJson.results.channels
                            : dgResJson.results.channels.map(function (channel) {
                                return options.searchSet
                                    ? __assign({ search: channel.search }, channel.alternatives[0]) : channel.alternatives[0];
                            }),
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
        httpRequest.write(payload);
        httpRequest.end();
    });
}

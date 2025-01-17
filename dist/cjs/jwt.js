"use strict";
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateJwtFields = exports.decomposeUnverifiedJwt = void 0;
const assert_js_1 = require("./assert.js");
const safe_json_parse_js_1 = require("./safe-json-parse.js");
const error_js_1 = require("./error.js");
const _node_web_compat_1 = require("#node-web-compat");
/**
 * Assert that the argument is a valid JWT header object.
 * Throws an error in case it is not.
 *
 * @param header
 * @returns void
 */
function assertJwtHeader(header) {
    if (!(0, safe_json_parse_js_1.isJsonObject)(header)) {
        throw new error_js_1.JwtParseError("JWT header is not an object");
    }
    if (header.alg !== undefined && typeof header.alg !== "string") {
        throw new error_js_1.JwtParseError("JWT header alg claim is not a string");
    }
    if (header.kid !== undefined && typeof header.kid !== "string") {
        throw new error_js_1.JwtParseError("JWT header kid claim is not a string");
    }
}
/**
 * Assert that the argument is a valid JWT payload object.
 * Throws an error in case it is not.
 *
 * @param payload
 * @returns void
 */
function assertJwtPayload(payload) {
    if (!(0, safe_json_parse_js_1.isJsonObject)(payload)) {
        throw new error_js_1.JwtParseError("JWT payload is not an object");
    }
    if (payload.exp !== undefined && !Number.isFinite(payload.exp)) {
        throw new error_js_1.JwtParseError("JWT payload exp claim is not a number");
    }
    if (payload.iss !== undefined && typeof payload.iss !== "string") {
        throw new error_js_1.JwtParseError("JWT payload iss claim is not a string");
    }
    if (payload.aud !== undefined &&
        typeof payload.aud !== "string" &&
        (!Array.isArray(payload.aud) ||
            payload.aud.some((aud) => typeof aud !== "string"))) {
        throw new error_js_1.JwtParseError("JWT payload aud claim is not a string or array of strings");
    }
    if (payload.nbf !== undefined && !Number.isFinite(payload.nbf)) {
        throw new error_js_1.JwtParseError("JWT payload nbf claim is not a number");
    }
    if (payload.iat !== undefined && !Number.isFinite(payload.iat)) {
        throw new error_js_1.JwtParseError("JWT payload iat claim is not a number");
    }
    if (payload.scope !== undefined && typeof payload.scope !== "string") {
        throw new error_js_1.JwtParseError("JWT payload scope claim is not a string");
    }
    if (payload.jti !== undefined && typeof payload.jti !== "string") {
        throw new error_js_1.JwtParseError("JWT payload jti claim is not a string");
    }
}
/**
 * Sanity check, decompose and JSON parse a JWT string into its constituent, and yet unverified, parts:
 * - header object
 * - payload object
 * - signature string
 *
 * This function does NOT verify a JWT, do not trust the returned payload and header!
 *
 * For most use cases, you would not want to call this function directly yourself, rather you
 * would call verify() with the JWT, which would call this function (and others) for you.
 *
 * @param jwt The JWT (as string)
 * @returns the decomposed, and yet unverified, JWT
 */
function decomposeUnverifiedJwt(jwt) {
    // Sanity checks on JWT
    if (!jwt) {
        throw new error_js_1.JwtParseError("Empty JWT");
    }
    if (typeof jwt !== "string") {
        throw new error_js_1.JwtParseError("JWT is not a string");
    }
    if (!jwt.match(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)) {
        throw new error_js_1.JwtParseError("JWT string does not consist of exactly 3 parts (header, payload, signature)");
    }
    const [headerB64, payloadB64, signatureB64] = jwt.split(".");
    // B64 decode header and payload
    const [headerString, payloadString] = [headerB64, payloadB64].map(_node_web_compat_1.nodeWebCompat.parseB64UrlString);
    // Parse header
    let header;
    try {
        header = (0, safe_json_parse_js_1.safeJsonParse)(headerString);
    }
    catch (err) {
        throw new error_js_1.JwtParseError("Invalid JWT. Header is not a valid JSON object", err);
    }
    assertJwtHeader(header);
    // parse payload
    let payload;
    try {
        payload = (0, safe_json_parse_js_1.safeJsonParse)(payloadString);
    }
    catch (err) {
        throw new error_js_1.JwtParseError("Invalid JWT. Payload is not a valid JSON object", err);
    }
    assertJwtPayload(payload);
    return {
        header,
        headerB64,
        payload,
        payloadB64,
        signatureB64,
    };
}
exports.decomposeUnverifiedJwt = decomposeUnverifiedJwt;
/**
 * Validate JWT payload fields. Throws an error in case there's any validation issue.
 *
 * @param payload The (JSON parsed) JWT payload
 * @param options The options to use during validation
 * @returns void
 */
function validateJwtFields(payload, options) {
    // Check expiry
    if (payload.exp !== undefined) {
        if (payload.exp + (options.graceSeconds ?? 0) < Date.now() / 1000) {
            throw new error_js_1.JwtExpiredError(`Token expired at ${new Date(payload.exp * 1000).toISOString()}`, payload.exp);
        }
    }
    // Check not before
    if (payload.nbf !== undefined) {
        if (payload.nbf - (options.graceSeconds ?? 0) > Date.now() / 1000) {
            throw new error_js_1.JwtNotBeforeError(`Token can't be used before ${new Date(payload.nbf * 1000).toISOString()}`, payload.nbf);
        }
    }
    // Check JWT issuer
    if (options.issuer !== null) {
        if (options.issuer === undefined) {
            throw new error_js_1.ParameterValidationError("issuer must be provided or set to null explicitly");
        }
        (0, assert_js_1.assertStringArrayContainsString)("Issuer", payload.iss, options.issuer, error_js_1.JwtInvalidIssuerError);
    }
    // Check audience
    if (options.audience !== null) {
        if (options.audience === undefined) {
            throw new error_js_1.ParameterValidationError("audience must be provided or set to null explicitly");
        }
        (0, assert_js_1.assertStringArraysOverlap)("Audience", payload.aud, options.audience, error_js_1.JwtInvalidAudienceError);
    }
    // Check scope
    if (options.scope != null) {
        (0, assert_js_1.assertStringArraysOverlap)("Scope", payload.scope?.split(" "), options.scope, error_js_1.JwtInvalidScopeError);
    }
}
exports.validateJwtFields = validateJwtFields;

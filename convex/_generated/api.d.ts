/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as adminStats from "../adminStats.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as caseStatus from "../caseStatus.js";
import type * as cases from "../cases.js";
import type * as deadlines from "../deadlines.js";
import type * as documents from "../documents.js";
import type * as http from "../http.js";
import type * as lawMonitor from "../lawMonitor.js";
import type * as letters from "../letters.js";
import type * as lib_authz from "../lib/authz.js";
import type * as lib_envCheck from "../lib/envCheck.js";
import type * as lib_serialize from "../lib/serialize.js";
import type * as loginAttempts from "../loginAttempts.js";
import type * as otp_ResendOTP from "../otp/ResendOTP.js";
import type * as otp_ResendOTPPasswordReset from "../otp/ResendOTPPasswordReset.js";
import type * as outcomes from "../outcomes.js";
import type * as packets from "../packets.js";
import type * as payments from "../payments.js";
import type * as r2 from "../r2.js";
import type * as sequences from "../sequences.js";
import type * as service from "../service.js";
import type * as storage from "../storage.js";
import type * as storageActions from "../storageActions.js";
import type * as subscriptions from "../subscriptions.js";
import type * as tavily from "../tavily.js";
import type * as trustStats from "../trustStats.js";
import type * as users from "../users.js";
import type * as waitlist from "../waitlist.js";
import type * as webhooks from "../webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  adminStats: typeof adminStats;
  audit: typeof audit;
  auth: typeof auth;
  caseStatus: typeof caseStatus;
  cases: typeof cases;
  deadlines: typeof deadlines;
  documents: typeof documents;
  http: typeof http;
  lawMonitor: typeof lawMonitor;
  letters: typeof letters;
  "lib/authz": typeof lib_authz;
  "lib/envCheck": typeof lib_envCheck;
  "lib/serialize": typeof lib_serialize;
  loginAttempts: typeof loginAttempts;
  "otp/ResendOTP": typeof otp_ResendOTP;
  "otp/ResendOTPPasswordReset": typeof otp_ResendOTPPasswordReset;
  outcomes: typeof outcomes;
  packets: typeof packets;
  payments: typeof payments;
  r2: typeof r2;
  sequences: typeof sequences;
  service: typeof service;
  storage: typeof storage;
  storageActions: typeof storageActions;
  subscriptions: typeof subscriptions;
  tavily: typeof tavily;
  trustStats: typeof trustStats;
  users: typeof users;
  waitlist: typeof waitlist;
  webhooks: typeof webhooks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  r2: import("@convex-dev/r2/_generated/component.js").ComponentApi<"r2">;
};

import axios from 'axios';
import { env } from '../config/env.js';

/**
 * Node has no database of its own — every data need is an HTTP call back
 * into Laravel. Two auth modes:
 *  - forwarded user JWT (user-triggered calls; Laravel's own role-based
 *    authorization applies automatically)
 *  - X-Internal-Token (cron-triggered calls with no user in context)
 */
export function laravelClientForUser(token) {
  return axios.create({
    baseURL: env.laravelApiUrl,
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function laravelClientForInternalService() {
  return axios.create({
    baseURL: env.laravelApiUrl,
    headers: { 'X-Internal-Token': env.internalServiceToken },
  });
}

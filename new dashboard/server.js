'use strict';

/**
 * AltLeads CRM — single-app entry point (for Hostinger's Node.js deployment).
 *
 * The whole app is ONE Node process:
 *   - serves the built React web app  (new-code/web/dist)
 *   - serves the email API            (lead assign / meeting / approval emails)
 *
 * All of that logic lives in new-code/notify-service/server.js, which uses
 * __dirname-relative paths, so we just start it from here. Hostinger config:
 *   Root directory : (repo root)
 *   Build command  : npm run build
 *   Entry file     : server.js
 *   Output dir     : (leave empty — the Node server serves the files itself)
 */

require('./new-code/notify-service/server.js');

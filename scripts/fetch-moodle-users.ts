import { config as loadEnv } from "dotenv";
import path from "node:path";
import process from "node:process";

import { MoodleClient } from "@/lib/moodle/client";

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), override: false });

interface PotentialUser {
  id: number;
  fullname: string;
  email?: string;
  profileimageurl?: string;
  profileimageurlsmall?: string;
  username?: string;
  idnumber?: string;
  department?: string;
}

// The actual Moodle API returns an array of users directly in the data field
type PotentialUsersResponse = PotentialUser[];

async function main() {
  const courseIdEnv = process.env.MOODLE_COURSE_ID;
  const enrolIdEnv = process.env.MOODLE_ENROL_ID;

  if (!courseIdEnv) {
    throw new Error("MOODLE_COURSE_ID env var is required to fetch potential users");
  }

  if (!enrolIdEnv) {
    throw new Error("MOODLE_ENROL_ID env var is required to fetch potential users");
  }

  const courseid = Number(courseIdEnv);
  const enrolid = Number(enrolIdEnv);

  if (Number.isNaN(courseid) || Number.isNaN(enrolid)) {
    throw new Error("MOODLE_COURSE_ID and MOODLE_ENROL_ID must be numeric");
  }

  const search = process.env.MOODLE_SEARCH_QUERY ?? "";
  const searchanywhere = process.env.MOODLE_SEARCH_ANYWHERE !== "false"; // Default to true
  const page = Number(process.env.MOODLE_PAGE ?? "0");
  const perpage = Number(process.env.MOODLE_PER_PAGE ?? "200");

  const client = MoodleClient.fromEnv();

  if (process.env.MOODLE_LOGIN_USERNAME && process.env.MOODLE_LOGIN_PASSWORD) {
    console.info(`[Moodle] Logging in as ${process.env.MOODLE_LOGIN_USERNAME}...`);
    await client.login();
  } else {
    console.info("[Moodle] Skipping login (no credentials provided); relying on existing cookies");
  }

  const sesskey = await client.fetchSesskey();
  console.info(`[Moodle] Using sesskey ${sesskey}`);

  const payload = await client.callService<PotentialUsersResponse>(
    process.env.MOODLE_METHOD_CORE_ENROL_GET_POTENTIAL_USERS ?? "core_enrol_get_potential_users",
    {
      courseid,
      enrolid,
      search,
      searchanywhere,
      page,
      perpage,
    },
    { sesskey }
  );

  console.info(`[Moodle] Retrieved ${payload.length} potential user(s)`);

  const rows = payload.map((user) => ({
    id: user.id,
    fullname: user.fullname,
    email: user.email ?? "",
    username: user.username ?? "",
    idnumber: user.idnumber ?? "",
    department: user.department ?? "",
  }));

  console.table(rows);
}

main().catch((err) => {
  console.error("[Moodle] Fetch failed", err);
  process.exitCode = 1;
});



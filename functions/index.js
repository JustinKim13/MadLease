const functions = require("firebase-functions");
const admin = require("firebase-admin");

// works directly through firebase functions, don't move to SlackService

admin.initializeApp();

const SLACK_WEBHOOK = functions.config().slack.webhook;

async function sendSlackMessage(text) {
  await fetch(SLACK_WEBHOOK, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text })
  });
}

//////////////////////////////////////////////////////////
// HELPER: COUNT USERS
//////////////////////////////////////////////////////////

async function getTotalUsers() {
  let nextPageToken;
  let total = 0;

  do {
    const result = await admin.auth().listUsers(1000, nextPageToken);
    total += result.users.length;
    nextPageToken = result.pageToken;
  } while (nextPageToken);

  return total;
}

//////////////////////////////////////////////////////////
// REALTIME EVENT: NEW USER
//////////////////////////////////////////////////////////

exports.notifyNewUser = functions.auth.user().onCreate(async (user) => {

  const userCount = await getTotalUsers();

  await sendSlackMessage(
`🎉 New MadLease Signup

Email: ${user.email}

Total Users: ${userCount}`
  );

  const milestones = [5, 10, 25, 50, 100, 250, 500, 1000];

  if (milestones.includes(userCount)) {
    await sendSlackMessage(
`🚀 MadLease Milestone Reached

${userCount} total users 🎉`
    );
  }

});

//////////////////////////////////////////////////////////
// DAILY REPORT
//////////////////////////////////////////////////////////

exports.dailyStats = functions.pubsub
  .schedule("every day 23:59")
  .timeZone("America/Chicago")
  .onRun(async () => {

    const users = await getTotalUsers();

    await sendSlackMessage(
`📊 MadLease Daily Report

Total Users: ${users}`
    );

});

//////////////////////////////////////////////////////////
// WEEKLY REPORT
//////////////////////////////////////////////////////////

exports.weeklyStats = functions.pubsub
  .schedule("every sunday 23:59")
  .timeZone("America/Chicago")
  .onRun(async () => {

    const users = await getTotalUsers();

    await sendSlackMessage(
`📈 MadLease Weekly Report

Total Users: ${users}`
    );

});

//////////////////////////////////////////////////////////
// MONTHLY REPORT
//////////////////////////////////////////////////////////

exports.monthlyStats = functions.pubsub
  .schedule("1 of month 23:59")
  .timeZone("America/Chicago")
  .onRun(async () => {

    const users = await getTotalUsers();

    await sendSlackMessage(
`🚀 MadLease Monthly Report

Total Users: ${users}`
    );

});

//////////////////////////////////////////////////////////
// YEARLY REPORT
//////////////////////////////////////////////////////////

exports.yearlyStats = functions.pubsub
  .schedule("0 0 1 1 *")
  .timeZone("America/Chicago")
  .onRun(async () => {

    const users = await getTotalUsers();

    await sendSlackMessage(
`🏆 MadLease Yearly Report

Total Users: ${users}`
    );

});
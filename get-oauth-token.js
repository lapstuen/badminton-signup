#!/usr/bin/env node

const { GoogleAuth } = require("google-auth-library");

async function getToken() {
  const auth = new GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
  });

  const client = await auth.getClient();
  const token = await client.getAccessToken();
  
  // Output only the token
  console.log(token.token);
}

getToken().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});

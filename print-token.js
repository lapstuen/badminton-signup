import { GoogleAuth } from "google-auth-library";

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
});

const client = await auth.getClient();
const token = await client.getAccessToken();

console.log("Access token starts with:", (token?.token || "").slice(0, 20));

const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const port = 3000;
const { auth, requiresAuth } = require("express-openid-connect");

const config = {
  authRequired: false,
  auth0Logout: true,
  baseURL: "http://localhost:3000",
  clientID: "2xEeiTf21ZTJpXmdPNV5X2dDOEJG81MJ",
  issuerBaseURL: "https://circlesapp.us.auth0.com",
  secret: "deda53d80e511a29137f3983e7bc9334b8a078831d215d1f6067ddf989843686",
};

app.use(auth(config));

app.use(express.static("public"));
app.use(bodyParser.json());

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

app.get('/', (req, res) => {
  res.send(
    req.oidc.isAuthenticated() ? 'Logged in' : 'Logged out'
  )
});

// The /profile route will show the user profile as JSON
app.get('/profile', requiresAuth(), (req, res) => {
  res.send(JSON.stringify(req.oidc.user, null, 2));
});
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const port = 3000;
const { auth, requiresAuth } = require("express-openid-connect");
const { initializeApp } = require("firebase/app");

const firebaseConfig = {
  apiKey: "AIzaSyCtWt4Lba8nqR7aLnwGeo67xDKiVDQxmbQ",
  authDomain: "circles-9f709.firebaseapp.com",
  projectId: "circles-9f709",
  storageBucket: "circles-9f709.appspot.com",
  messagingSenderId: "212292467729",
  appId: "1:212292467729:web:bd97f37be77b3da95805b0",
  measurementId: "G-7XMYQT401W",
};

const firebaseApp = initializeApp(firebaseConfig);

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

app.get("/", (req, res) => {
  res.send(req.oidc.isAuthenticated() ? "Logged in" : "Logged out");
});

// The /profile route will show the user profile as JSON
app.get("/profile", requiresAuth(), (req, res) => {
  res.send(JSON.stringify(req.oidc.user, null, 2));
});

const saveUserToFirestore = async (user) => {
  try {
    if (!user) return;
    const docRef = doc(collection(db, "users"), user.clientID);
    const docSnap = await getDoc(docRef);

    await setDoc(docRef, {
      name: user.name,
      email: user.email,
      createdAt: new Date().toISOString(),
      matches: [],
    });
  } catch (error) {
    console.error("Error writing document: ", error);
  }
};

const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const port = 3000;
const { auth, requiresAuth } = require("express-openid-connect");
const { initializeApp } = require("firebase/app");
const {
  getFirestore,
  collection,
  getDoc,
  doc,
  setDoc,
} = require("firebase/firestore");

// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCtWt4Lba...",
  authDomain: "circles-9f709.firebaseapp.com",
  projectId: "circles-9f709",
  storageBucket: "circles-9f709.appspot.com",
  messagingSenderId: "212292467729",
  appId: "1:212292467729:web:bd97f37be77b3da95805b0",
  measurementId: "G-7XMYQT401W",
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Express OpenID Connect configuration
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

app.get("/", (req, res) => {
  res.send(req.oidc.isAuthenticated() ? "Logged in" : "Logged out");
});

app.get("/profile/:uid", requiresAuth(), async (req, res) => {
  const { uid } = req.params;
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    res.json({ success: true, user: docSnap.data() });
  } else {
    res.status(404).json({ success: false, message: "User not found" });
  }
});

app.get("/myuser", requiresAuth(), (req, res) => {
  var uid = req.oidc.user.sub;

  const docRef = doc(db, "users", uid);
  getDoc(docRef).then((docSnap) => {
    if (docSnap.exists()) {
      res.json({ success: true, user: docSnap.data() });
    } else {
      var user = {
        uid: uid,
        name: req.oidc.user.name,
        email: req.oidc.user.email,
        picture: req.oidc.user.picture,
        interests: [],
        schools: [],
        bio: "",
      };

      setDoc(docRef, user).then(() => {
        res.json({ success: true, user: user });
      });
    }
  });
});

app.listen(port, () => {
  console.log(`Circles listening on port ${port}`);
});

app.get("/matches", requiresAuth(), async (req, res) => {
  const { uid } = req.params;
  const docRef = doc(collection(db, "users"), uid);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const matches = docSnap.data().matches;
    console.log(matches);
    res.json(matches);
  } else {
    res.status(404).json({ success: false, message: "User not found" });
  }
})


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
  query,
  where,
  getDocs,
  addDoc,
} = require("firebase/firestore");

app.set("view engine", "ejs");

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

app.post("/profile/edit", requiresAuth(), async (req, res) => {
  const { bio, interests, schools } = req.body;
  const uid = req.oidc.user.sub;

  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const user = docSnap.data();
    user.bio = bio;
    user.interests = interests;
    user.schools = schools;
    setDoc(docRef, user).then(() => {
      res.json({ success: true, user: user });
    });
  } else {
    res.status(404).json({ success: false, message: "User not found" });
  }
});

app.post("/chats/:destuser", requiresAuth(), async (req, res) => {
  const duid = req.params.destuser; // Destination user ID
  const uid = req.oidc.user.sub; // Source user ID

  // Create a new chat between the two users
  const chat = {
    messages: [],
    users: [uid, duid],
  };

  const chatRef = collection(db, "chats");
  try {
    const newChatDoc = await addDoc(chatRef, chat);
    res.json({ success: true, chat: chat, chatId: newChatDoc.id });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/chats", requiresAuth(), async (req, res) => {
  try {
    const uid = req.oidc.user.sub;

    // Fetch chats that include the current user
    const chatsRef = collection(db, "chats");
    const q = query(chatsRef, where("users", "array-contains", uid));
    const querySnapshot = await getDocs(q);

    // Map chats to an array of objects
    const chats = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Collect UIDs of other users
    const otherUserUIDsSet = new Set();
    chats.forEach((chat) => {
      chat.users
        .filter((userUid) => userUid !== uid)
        .forEach((otherUid) => otherUserUIDsSet.add(otherUid));
    });
    const otherUserUIDs = Array.from(otherUserUIDsSet);

    // Fetch other users' names
    const otherUserNamesMap = {};
    const userPromises = otherUserUIDs.map(async (otherUid) => {
      const userDocRef = doc(db, "users", otherUid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        otherUserNamesMap[otherUid] = userDocSnap.data().name;
      } else {
        otherUserNamesMap[otherUid] = null; // User not found
      }
    });
    await Promise.all(userPromises);

    // Attach the other users' names to each chat
    const chatsWithNames = chats.map((chat) => {
      const otherUserUIDs = chat.users.filter((userUid) => userUid !== uid);
      const otherUserNames = otherUserUIDs.map(
        (otherUid) => otherUserNamesMap[otherUid],
      );
      return {
        ...chat,
        otherUserNames: otherUserNames,
      };
    });

    res.json({ success: true, chats: chatsWithNames });
  } catch (error) {
    console.error("Error fetching chats:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/chats/:chatid", async (req, res) => {
  try {
    const chatId = req.params.chatid;

    const currentUserUID = req.oidc.user.sub;

    // Fetch the chat document by chatId
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
      return res
        .status(404)
        .json({ success: false, message: "Chat not found" });
    }

    const chatData = chatSnap.data();

    // Collect UIDs of other users in the chat, excluding the current user
    const otherUserUIDs = (chatData.users || []).filter(
      (uid) => uid !== currentUserUID,
    );

    // Fetch names of other users
    const otherUserNames = [];
    const userPromises = otherUserUIDs.map(async (otherUid) => {
      const userDocRef = doc(db, "users", otherUid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        otherUserNames.push(userDocSnap.data().name);
      } else {
        otherUserNames.push(null); // Handle the case where the user document doesn't exist
      }
    });
    await Promise.all(userPromises);

    // Prepare the chat data with only the other user's username(s)
    const chatWithOtherUserNames = {
      id: chatId,
      messages: chatData.messages,
      otherUserNames: otherUserNames,
    };

    // Send the response
    res.json({ success: true, chat: chatWithOtherUserNames });
  } catch (error) {
    console.error("Error fetching chat:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/chats/:chatid/messages", requiresAuth(), async (req, res) => {
  try {
    const chatId = req.params.chatid;
    const uid = req.oidc.user.sub; // Authenticated user ID
    const { message } = req.body; // Message content from the request body

    // Validate message content
    if (!message) {
      return res
        .status(400)
        .json({ success: false, message: "Message content is required" });
    }

    // Fetch the chat document from Firestore
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
      return res
        .status(404)
        .json({ success: false, message: "Chat not found" });
    }

    const chatData = chatSnap.data();

    // Check if the user is a participant in the chat
    if (!chatData.users.includes(uid)) {
      return res.status(403).json({
        success: false,
        message: "User not a participant in the chat",
      });
    }

    // Create a new message object
    const newMessage = {
      uid: uid,
      message: message,
      timestamp: new Date().toISOString(),
    };

    var updatedMessages;

    if (chatData.messages.length > 0) {
      // Append the new message to the messages array
      updatedMessages = chatData.messages
        ? [...chatData.messages, newMessage]
        : [newMessage];
    } else {
      updatedMessages = [newMessage];
    }

    // Update the chat document in Firestore
    await setDoc(chatRef, { ...chatData, messages: updatedMessages });

    res.json({ success: true, message: "Message sent", chatId: chatId });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/isauthed", (req, res) => {
  if (req.oidc.isAuthenticated()) {
    res.json({ isAuthed: req.oidc.isAuthenticated(), uid: req.oidc.user.sub });
  } else {
    res.json({ isAuthed: req.oidc.isAuthenticated() });
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
        matches: [],
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
  try {
    const uid = req.oidc.user.sub;
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const usersSnapshot = await getDocs(collection(db, "users"));
    const users = [];

    // Populate users array
    usersSnapshot.forEach((doc) => {
      users.push({ uid: doc.uid, ...doc.data() });
    });

    const targetUser = users.find((u) => u.uid === uid);
    if (!targetUser) {
      return res.status(404).send("Target user not found");
    }

    const matches = users.filter((user) => {
      return (
        user.uid !== uid && // Use user.id to exclude the target user
        user.schools.filter((x) => targetUser.schools.includes(x)).length +
          user.interests.filter((x) => targetUser.interests.includes(x))
            .length *
            2 >=
          3
      );
    });

    console.log(matches);

    if (matches != undefined) {
      await setDoc(docRef, { ...docSnap.data(), matches: matches });
    }

    // Render the matches page with the matched users
    res.render("matches", { matches: docSnap.data().matches });
  } catch (error) {
    console.error("Error fetching users or updating Firestore:", error);
    res.status(500).send("Failed to fetch users or update Firestore");
  }
});

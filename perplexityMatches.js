const fs = require('fs');
const axios = require('axios');  // To make API requests
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK with your service account
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://your-project-id.firebaseio.com"  // Replace with your Firestore URL
});

const db = admin.firestore();

// Fetch users from Firestore
async function fetchUsersFromFirestore() {
  const usersSnapshot = await db.collection('users').get();
  const users = [];

  usersSnapshot.forEach((doc) => {
    users.push({ uid: doc.uid, ...doc.data() });
  });

  return users;
}

// Send data to Perplexity and return the response
async function findMatchesWithPerplexity(users, targetUserId) {
  const targetUser = users.find(u => u.uid == targetUserId);
  if (!targetUser) {
    console.error('Target user not found');
    return;
  }

  const prompt = `
    I have the following list of users in JSON format:

    ${JSON.stringify(users)}

    I want you to find the best matches for the user with ID ${targetUserId} based on shared attributes such as school and interests. 
    Please compare ${targetUser.name}'s school and interests with other users, and return the results in the same JSON format. 
    Add a new field called "score" to each user, which represents how similar they are. Sort the results by this score in descending order, excluding the target user.
  `;

  try {
    const response = await axios.post('https://api.perplexity.ai/v1/completions', {
      prompt: prompt,
      temperature: 0.7,
      max_tokens: 500,
      api_key: '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'
    });

    const result = response.data;
    fs.writeFileSync('./output/results.json', JSON.stringify(result, null, 2));
    console.log('Results saved to results.json');

  } catch (error) {
    console.error('Error communicating with Perplexity:', error);
  }
}

// Main function to fetch users and send to Perplexity
export async function run(targetUserId) {
  const users = await fetchUsersFromFirestore();
  await findMatchesWithPerplexity(users, targetUserId);
}

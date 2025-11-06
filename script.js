// Worker URL (must be a string) — using the link you provided
const workerURL = "https://wanderbot.unofffgghh.workers.dev/";

/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");

/* NOTE: removed currentQuestion/currentQuestionText references since the top preview was removed */

// Set initial message (showed as Chatbot)
appendMessage("ai", "👋 Hello! How can I help you today?");

/* Helper: append a message to the chat window
   - Adds a sender label ("You" for user, "Chatbot" for AI) before the message text.
   - Uses DOM methods and textContent for safety.
*/
function appendMessage(role, text) {
  // role is "user" or "ai"
  const el = document.createElement("div");
  el.className = `msg ${role}`;

  // Determine the visible sender label
  const senderLabel = role === "user" ? "You" : "Chatbot";

  // Create label element (bold) and message text element
  const labelEl = document.createElement("strong");
  labelEl.className = "msg-sender";
  labelEl.textContent = `${senderLabel}: `;

  const textEl = document.createElement("span");
  textEl.className = "msg-text";
  textEl.textContent = text;

  // Append label + text to message container
  el.appendChild(labelEl);
  el.appendChild(textEl);

  // Add to chat window and scroll to bottom
  chatWindow.appendChild(el);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userText = userInput.value.trim();
  if (!userText) return;

  // Show the user's message in the chat
  appendMessage("user", userText);
  userInput.value = "";
  userInput.focus();

  // Show a typing indicator while we wait for the Worker/OpenAI response
  const typingIndicator = document.createElement("div");
  typingIndicator.className = "msg ai";
  typingIndicator.textContent = "AI is typing…";
  chatWindow.appendChild(typingIndicator);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  // Prepare the messages array (Cloudflare Worker expects messages)
  const messages = [
    {
      role: "system",
      content:
        "You are a helpful product advisor for L'Oréal. Answer concisely and politely.",
    },
    { role: "user", content: userText },
  ];

  try {
    // Send the messages to the Cloudflare Worker which proxies to OpenAI
    // We use async/await and a simple fetch call (no libraries).
    const resp = await fetch(workerURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      // include the model and messages; worker can choose to respect these
      body: JSON.stringify({
        model: "gpt-4o",
        messages: messages,
      }),
    });

    if (!resp.ok) {
      // Try to read response body for debugging, then throw
      const errText = await resp.text();
      console.error("Worker error response:", resp.status, errText);
      throw new Error(`Worker error: ${resp.status}`);
    }

    const data = await resp.json();

    // Extract assistant content using the messages-style response shape
    const aiText =
      (data &&
        data.choices &&
        data.choices[0] &&
        data.choices[0].message &&
        data.choices[0].message.content) ||
      (data && data.choices && data.choices[0] && data.choices[0].text) ||
      data?.output_text ||
      null;

    if (!aiText) {
      console.error("Unexpected response shape from worker:", data);
      typingIndicator.remove();
      appendMessage(
        "ai",
        "Sorry, I didn't get a response. Check browser console for details."
      );
      return;
    }

    // Remove typing indicator and show AI message
    typingIndicator.remove();
    appendMessage("ai", aiText);
  } catch (err) {
    // On error, remove typing indicator and show a helpful error message
    typingIndicator.remove();
    appendMessage(
      "ai",
      "Sorry, something went wrong. Check the console for details."
    );
    console.error("Error fetching AI response:", err);
  }
});

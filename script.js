// ==================================================
// SAIRAM ENTERPRISES - MAIN JAVASCRIPT
// AI ASSISTANT + CONTACT FORM
// ==================================================

console.log("Sairam Enterprises website loaded successfully!");

// ==================================================
// SAIRAM AI CHAT
// ==================================================

const aiInput = document.getElementById("aiInput");
const sendAI = document.getElementById("sendAI");
const chatMessages = document.getElementById("chatMessages");

// ==================================================
// SAFE HTML
// ==================================================

function escapeHTML(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ==================================================
// FORMAT AI RESPONSE
// ==================================================

function formatAIResponse(text) {
    const lines = String(text || "").replace(/\r/g, "").split("\n");
    let html = "";
    let inList = false;
    let listType = "";

    function closeList() {
        if (inList) {
            html += listType === "ol" ? "</ol>" : "</ul>";
            inList = false;
            listType = "";
        }
    }

    function formatInline(value) {
        let safe = escapeHTML(value);
        safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        safe = safe.replace(/\*(.+?)\*/g, "<em>$1</em>");
        return safe;
    }

    lines.forEach((line) => {
        const trimmed = line.trim();

        if (!trimmed) {
            closeList();
            return;
        }

        if (/^\|?[\s:|-]+\|?$/.test(trimmed) && trimmed.includes("-")) {
            closeList();
            return;
        }

        if (trimmed.includes("|")) {
            closeList();
            const cells = trimmed
                .replace(/^\|/, "")
                .replace(/\|$/, "")
                .split("|")
                .map(cell => cell.trim())
                .filter(Boolean);

            if (cells.length) {
                html += `<p class="ai-answer-paragraph">${cells.map(formatInline).join(" — ")}</p>`;
            }
            return;
        }

        if (/^#{1,3}\s+/.test(trimmed)) {
            closeList();
            const heading = trimmed.replace(/^#{1,3}\s+/, "");
            html += `<h3 class="ai-answer-heading">${formatInline(heading)}</h3>`;
            return;
        }

        const numbered = trimmed.match(/^\d+[.)]\s+(.+)/);
        if (numbered) {
            if (!inList || listType !== "ol") {
                closeList();
                html += '<ol class="ai-answer-list">';
                inList = true;
                listType = "ol";
            }
            html += `<li>${formatInline(numbered[1])}</li>`;
            return;
        }

        const bullet = trimmed.match(/^[-*•]\s+(.+)/);
        if (bullet) {
            if (!inList || listType !== "ul") {
                closeList();
                html += '<ul class="ai-answer-list">';
                inList = true;
                listType = "ul";
            }
            html += `<li>${formatInline(bullet[1])}</li>`;
            return;
        }

        closeList();
        html += `<p class="ai-answer-paragraph">${formatInline(trimmed)}</p>`;
    });

    closeList();
    return html;
}

// ==================================================
// ADD MESSAGE TO CHAT
// ==================================================

function addMessage(type, content, isHTML = false) {
    if (!chatMessages) return null;

    const message = document.createElement("div");
    message.className = `message ${type}-message`;
    message.style.width = "100%";
    message.style.minWidth = "0";
    message.style.boxSizing = "border-box";

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = type === "ai" ? "AI" : "";

    const messageContent = document.createElement("div");
    messageContent.className = "message-content";
    messageContent.style.flex = "1";
    messageContent.style.minWidth = "0";
    messageContent.style.maxWidth = type === "user" ? "70%" : "100%";
    messageContent.style.width = "100%";
    messageContent.style.boxSizing = "border-box";
    messageContent.style.overflowWrap = "anywhere";
    messageContent.style.whiteSpace = "normal";

    if (type === "ai") {
        const name = document.createElement("strong");
        name.textContent = "Sairam AI";

        const answer = document.createElement("div");
        answer.className = "ai-response";
        answer.style.display = "block";
        answer.style.width = "100%";
        answer.style.maxWidth = "100%";
        answer.style.minWidth = "0";
        answer.style.boxSizing = "border-box";
        answer.style.whiteSpace = "normal";
        answer.style.overflowWrap = "anywhere";

        if (isHTML) {
            answer.innerHTML = content;
        } else {
            answer.textContent = content;
        }

        messageContent.appendChild(name);
        messageContent.appendChild(answer);
        message.appendChild(avatar);
    } else {
        const paragraph = document.createElement("p");
        paragraph.textContent = content;
        messageContent.appendChild(paragraph);
    }

    message.appendChild(messageContent);
    chatMessages.appendChild(message);
    return message;
}

// ==================================================
// SCROLL CHAT TO BOTTOM
// ==================================================

function scrollChat() {
    const chatBox = document.querySelector(".chat-box");

    if (chatBox) {
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// ==================================================
// SEND AI MESSAGE
// ==================================================

async function sendAIMessage() {
    if (!aiInput || !chatMessages) return;

    const question = aiInput.value.trim();
    if (!question) return;

    if (sendAI) sendAI.disabled = true;

    addMessage("user", question);
    aiInput.value = "";

    const thinkingMessage = addMessage(
        "ai",
        '<p class="ai-thinking">Sairam AI is thinking...</p>',
        true
    );

    scrollChat();

    try {
        const response = await fetch("/ask-ai", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ question })
        });

        const data = await response.json();
        const answerBox = thinkingMessage
            ? thinkingMessage.querySelector(".ai-response")
            : null;

        if (response.ok && data.answer) {
            if (answerBox) {
                answerBox.innerHTML = formatAIResponse(data.answer);
            }
        } else if (answerBox) {
            answerBox.textContent =
                data.error || "Sorry, I couldn't generate a response.";
        }
    } catch (error) {
        console.error("AI Chat Error:", error);

        const answerBox = thinkingMessage
            ? thinkingMessage.querySelector(".ai-response")
            : null;

        if (answerBox) {
            answerBox.textContent =
                "Unable to connect to Sairam AI. Please check your server.";
        }
    } finally {
        if (sendAI) sendAI.disabled = false;
        scrollChat();
    }
}

if (sendAI) {
    sendAI.addEventListener("click", sendAIMessage);
}

if (aiInput) {
    aiInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendAIMessage();
        }
    });
}

// ==================================================
// CONTACT FORM + ATTRACTIVE SUCCESS POPUP
// ==================================================

const contactForm = document.getElementById("contactForm");
const successDialog = document.getElementById("successDialog");
const successClose = document.getElementById("successClose");

function showSuccessPopup(message) {
    if (!successDialog) {
        alert(message || "Your enquiry has been submitted successfully!");
        return;
    }

    const messageBox = successDialog.querySelector("p");

    if (messageBox) {
        messageBox.textContent =
            message || "Your enquiry has been submitted successfully!";
    }

    if (!successDialog.open) {
        successDialog.showModal();
    }
}

if (successClose && successDialog) {
    successClose.addEventListener("click", function () {
        successDialog.close();
    });
}

if (successDialog) {
    successDialog.addEventListener("click", function (event) {
        if (event.target === successDialog) {
            successDialog.close();
        }
    });
}

if (contactForm) {
    contactForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const formData = {
            name: document.getElementById("name").value.trim(),
            phone: document.getElementById("phone").value.trim(),
            email: document.getElementById("email").value.trim(),
            service: document.getElementById("service").value,
            message: document.getElementById("message").value.trim()
        };

        const submitButton = contactForm.querySelector(
            'button[type="submit"]'
        );

        try {
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = "Sending...";
            }

            const response = await fetch("/contact", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                contactForm.reset();

                showSuccessPopup(
                    data.message ||
                    "Your enquiry has been submitted successfully!"
                );
            } else {
                alert(
                    data.message ||
                    "Something went wrong. Please try again."
                );
            }
        } catch (error) {
            console.error("Contact Form Error:", error);
            alert("Unable to connect to the server. Please try again.");
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "Send Enquiry →";
            }
        }
    });
}

console.log("Sairam AI chat and contact form initialized!");
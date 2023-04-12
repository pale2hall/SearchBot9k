
function scrollToBottom() {
  const messages = document.getElementById("messages");
  messages.scrollTop = messages.scrollHeight;
}

window.electron.onUpdateMessages((_, messages) => {
  document.getElementById("messages").innerHTML = messages
    .map(
      (message) =>
        `<div class="role-${message.role}">${message.role}: ${message.content}</div>`
    )
    .join("");
  scrollToBottom();
});

window.electron.onUpdateWebPageImage((_, base64Image) => {
  document.getElementById(
    "webpage-image"
  ).src = `data:image/png;base64,${base64Image}`;
});

window.electron.onUpdateURL((_, url) => {
  document.getElementById("address_bar").value = url;
});

window.electron.onUpdateAnswer((_, answer) => {
  document.getElementById("answer-text").innerHTML = answer;
  document.getElementById("answer").style.zIndex = 9001;
});

// Catch upates of the token usage
window.electron.onUpdateTokenUsage((_, tokenUsage) => {
  document.getElementById("token-usage").innerHTML = tokenUsage;
});

// Catch upates of the web activity
window.electron.onUpdateWebActivity((_, webActivity) => {
  document.getElementById("web-activity").innerHTML = webActivity;
});
// Catch upates of the web activity
window.electron.onUpdateSetHTML((_, update) => {
  document.getElementById(update.id).innerHTML = update.html;
});




function scrollToBottom() {
  const messages = document.getElementById("messages");
  messages.scrollTop = messages.scrollHeight;
}

window.electron.onUpdateMessages((_, messages) => {
  document.getElementById("messages").innerHTML = messages
    .map(
      (message) =>
        `<div class="message role-${message.role}"><div class="badgebadge-${message.role}">${message.role}</div>${message.content}</div>`
    )
    .join("");
  scrollToBottom();
});

window.electron.onUpdateWebPageImage((_, base64Image) => {
  document.getElementById(
    "webpage-image"
  ).src = `data:image/png;base64,${base64Image}`;
});

window.electron.onUpdateAnswer((_, answer) => {
  document.getElementById("answer-text").innerHTML = answer;
  document.getElementById("answer").style.zIndex = 9001;
});

window.electron.onUpdateSetText((_, update) => {
  const element = document.getElementById(update.id);
  if (element) {
    element.innerHTML = update.text;
  } else {
    console.log(
      `Element with id '${update.id}' not found in the DOM.` +
      `Unable to update text to: '${update.text}'`
      );
    
  }
});


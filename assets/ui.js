
      // Function to scroll to the bottom of the right panel
      function scrollToBottom() {
        const rightPane = document.getElementById("right-pane");
        rightPane.scrollTop = rightPane.scrollHeight;
      }

      // Call the function to scroll to the bottom on every update
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
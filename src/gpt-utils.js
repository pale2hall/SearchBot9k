
const axios = require("axios");
require("dotenv").config();

const tokensUsed = {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
}

function formatLinksForChat(links) {
    let formattedLinks = "";
    links.forEach((link) => {
        if (link.title === "") {
            formattedLinks += `\n- ${link.url}`;
        }
        formattedLinks += `\n- ${link.title} - ${link.url}`;
    });
    formattedLinks += "\n\n";
    if(process.env.openAI_MODEL === "gpt-3.5-turbo")
        formattedLinks = JSON.stringify({links:formattedLinks.split('\n')})
    return formattedLinks;
}

function updateAndDisplayTokensUsed(usage) {
    tokensUsed.total_tokens += usage.total_tokens;
    tokensUsed.prompt_tokens += usage.prompt_tokens;
    tokensUsed.completion_tokens += usage.prompt_tokens;

    let status_bar = `Total Tokens Used: ${tokensUsed.total_tokens} `;
    let output = `==== TOKEN USAGE ==== \nTotal Tokens Used: ${tokensUsed.total_tokens} `
        + `(Prompt: ${tokensUsed.prompt_tokens}, Completion: ${tokensUsed.completion_tokens})`;


    if (process.env.MODEL_PRICE_PER_TOKEN_PROMPT) {

        let prompt_cost = tokensUsed.prompt_tokens * process.env.MODEL_PRICE_PER_TOKEN_PROMPT;
        let completion_cost = tokensUsed.completion_tokens * process.env.MODEL_PRICE_PER_TOKEN_COMPLETION;
        let total_cost = prompt_cost + completion_cost;

        prompt_cost = (prompt_cost / 1000).toFixed(2);
        completion_cost = (completion_cost / 1000).toFixed(2);
        total_cost = (total_cost / 1000).toFixed(2);

        output += `\nTotal Costs: \$${total_cost} `
            + `(Prompt: \$${prompt_cost}, Completion: \$${completion_cost})\n\n`;
        status_bar += ` ( \$${total_cost} )`;
    }
    console.log(output);
    //return less verbose version to use as status bar.
    return status_bar;

}


function truncateMaxTokens(gptEncoder, content, max_tokens) {
    // 15 is way over avg char / token, but it's a good starting point
    let max_char_count = max_tokens * 15;
    content = truncate(content, max_char_count);
    let tokens = gptEncoder(content);
    let token_count = max_tokens + 1;
    while (token_count > max_tokens) {
        let multiplier_to_lower_tokens = (max_tokens / token_count);
        max_char_count = multiplier_to_lower_tokens * max_char_count * .95;
        content = truncate(content, max_char_count);
        tokens = gptEncoder(content);
        token_count = tokens.length;
    }
    return content;
}

async function chatGPT(messages, mainWindow) {
    const requestFn = () =>
        axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: process.env.OPENAI_MODEL,
                messages,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                },
            }
        );



    const response = await retryAxiosRequest(requestFn);
    // outputs to console and returns as string.
    let usage = updateAndDisplayTokensUsed(response.data.usage);

    mainWindow.webContents.send("update-set-text", {
        id: "token-usage",
        text: usage,
    });


    return response.data.choices[0].message.content;
}


async function retryAxiosRequest(requestFn, maxRetries = 4) {
    let retries = 0;
    let result;
    let success = false;

    while (!success && retries < maxRetries) {
        try {
            result = await requestFn();
            success = true;
        } catch (error) {
            console.log(`Retry ${retries + 1} failed: ${error.message}`);
            if (error.response && error.response.status === 429) {
                console.log(error.response.data.error);
                retries++;
                await sleep(Math.pow(2, retries) * 1000); // Exponential backoff
            } else {
                throw error;
            }
        }
    }

    if (!success) {
        throw new Error(`Request failed after ${retries} retries. `);
    }

    return result;
}


function salvageJSON(badJSON) {
    let startIndex = -1;
    let endIndex = -1;
  
    for (let i = 0; i < badJSON.length; i++) {
      if (badJSON[i] === '{' || badJSON[i] === '[') {
        startIndex = i;
        break;
      }
    }
  
    if (startIndex !== -1) {
      for (let i = startIndex; i < badJSON.length; i++) {
        if (badJSON[i] === '}' || badJSON[i] === ']') {
          endIndex = i;
          break;
        }
      }
    }
  
    if (startIndex !== -1 && endIndex !== -1) {
      const jsonString = badJSON.slice(startIndex, endIndex + 1);
      try {
        const parsed = JSON.parse(jsonString);
        return parsed;
      } catch (error) {
        // Ignore the error and return false if JSON is invalid
        return false;
      }
    } else {
      return false;
    }
  }

function truncate(text, maxLength) {
    if (text.length <= maxLength) {
        return text;
    }
    return text.substr(0, maxLength - 3) + "...";
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
    truncateMaxTokens,
    sleep,
    formatLinksForChat,
    chatGPT,
    salvageJSON,
};


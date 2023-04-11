const axios = require('axios');
const puppeteer = require('puppeteer');
require('dotenv').config()
const { app, BrowserWindow } = require('electron');


//load openai api key form .env
const sb9k_prompt = ` sb9k, or SearchBot9k is an advanced tool to search the internet.  
sb9k uses ChatGPT as a backend to provide logic to a script that handles the actual search.  
sb9k has the following commands avialble:
\`answer\`, \`navigate\` and \`search\`. 
sb9k always responds in JSON format with {"answer": "ANSWER", "remember:"<memories go here>"}, {"navigate": "URL", "remember:"<memories go here>"}, or {"search": "NEW SEARCH PHRASE", "remember:"<memories go here>"}. 
sb9k uses memories to keep track of its train of thought.
sb9k knows to ALWAYS provide fully qualified URLs for links.
sb9k knows how to use boolean to search more effectively.
sb9k makes detailed step-by-step plans to find the answer.
sb9k always adds {"remember": "things to remember"} object to the JSON response so it can keep its train of thought.
sb9k can load arbitrary webpages and extract text from them, for example: if sb9k needs to lookup info about something on wikipedia it can load en.wikipedia.org/wiki/Page_Name and extract the text from the page.

== Sample workflow ==
sb9k is asked to look up something obscure
sb9k comes up with a search phrase
sb9k is provided the results
sb9k notices that google 'corrected' its search phrase.
sb9k remembers this event.
sb9k uses "double quotes" to search for the exact phrase, especially if it thinks google 'corrected' it.
sb9k loads a page.
sb9k doesn't find the answer. [sb9k remembers this event]
sb9k loads another page.
sb9k finds the answer.
sb9k summarizes the results.

sb9k's first command is always search.
Please act as sb9k and find the answer for the user.
ONLY answer in properly fomatted JSON, because anything else will get caught as an error.
`;


async function chatGPT(messages) {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: process.env.OPENAI_MODEL,
        messages,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );
  
    const mainWindow = BrowserWindow.getAllWindows()[0];
    mainWindow.webContents.send('update-messages', messages);
  
    return response.data.choices[0].message.content;
}

async function googleSearch(query) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`https://google.com/search?q=${query}`);
  
    const links = await page.evaluate(() => {
      const linkNodes = document.querySelectorAll('.tF2Cxc h3, .card-section');
      return Array.from(linkNodes).map((link) => {
        const anchor = link.parentElement.parentElement.querySelector('a');
        const url = anchor.href;
        const domain = new URL(url).hostname;
        return { title: link.innerText, url, domain };
      });
    });

    const content = await page.evaluate(() => {
        return document.documentElement.innerText;
      });
  
    const screenshot = await page.screenshot({ encoding: 'base64' });
    loadWebPageImage(screenshot);
    await browser.close();
  
    return {"links":links, "content":content};
}

async function getPageContent(url) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(url, { waitUntil: 'networkidle2' });
  
    const content = await page.evaluate(() => {
      return document.documentElement.innerText;
    });
  
    const screenshot = await page.screenshot({ encoding: 'base64' });
    await browser.close();
  
    loadWebPageImage(screenshot);
  
    return content;
}

function loadWebPageImage(base64Image) {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    mainWindow.webContents.send('update-webpage-image', base64Image);
}

async function createWindow() {
    try {
      const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: true,
          preload: `${__dirname}/assets/preload.js`,
        },
      });
  
      mainWindow.loadFile('index.html');
      // mainWindow.webContents.openDevTools();
      // mainWindow.webContents.on('context-menu', (e) => e.preventDefault());

      const initialQuestion = process.argv[2];
      // init messages
      const messages = [
        { 
            role: 'system', 
            content: sb9k_prompt + 
`The user wants to know: '${initialQuestion}'. `
        },
      ];

      mainWindow.webContents.send('update-messages', messages);
      let answered = false;
      while (!answered){
        let gptResponse = "";
        if (process.env.OFFLINE){
          gptResponse = await Promise.resolve('{"search": "how to make a chatbot"}');
          answered = true;
        } else {
          gptResponse = await chatGPT(messages);
        }
        const jsonResponse = JSON.parse(gptResponse);

        messages.push({ role: 'assistant', content: gptResponse  });

        let next_message = "";

        if (jsonResponse.remember) {
            next_message = `\n==== \nsb9k wants to remember: \n${jsonResponse.remember} \n====\n\n`;
        }
        
        if (jsonResponse.answer) {
            // answer question and end script
            console.log(`Answer: ${jsonResponse.answer}`);
            next_message = next_message + `Here is the answer: ${jsonResponse.answer}`;
            answered = true;
            // TODO, tell Electron about the answer being found and spawn an alert message.
        } else if (jsonResponse.search) {
            // search a new query
            console.log(`New search phrase: ${jsonResponse.search}`);
            const serp = await googleSearch(jsonResponse.search);
            next_message =  next_message +
            `Here's the content of the page:\n
            ${serp.content}
        \n\n
            Here are the search results:\n${serp.links.map((link, index) => `[${index + 1}] ${link.title} (${link.domain})`).join('\n')}`;
        } else if (jsonResponse.navigate) {
            
            console.log(`Link: ${jsonResponse.navigate}`);
            const pageContent = await getPageContent(jsonResponse.navigate);
            next_message =  next_message + `Here is the 1st 2000 chars of the selected link:\n${truncate(pageContent, 2000)}`;
            
        } else {
            console.log('Unknown response', jsonResponse);
        }
        
        messages.push({
            role: "system", content: sb9k_prompt,
             role: 'user', content: next_message 
            });
        mainWindow.webContents.send('update-messages', messages);
      }
    } catch (error) {
      console.error('Error:', error);
    }
}

function truncate(text, maxLength) {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substr(0, maxLength - 3) + '...';
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
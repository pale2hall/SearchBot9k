# SearchBot9k

SearchBot9k is a simple Electron-based application that spawns a web page and searches for answers to users' questions. 

*Please note that the application might sometimes get into loops, and not all errors are handled yet. A refactor is on the to-do list.*

Contributions are welcome! Feel free to submit pull requests to help improve the project.

[![Demo Video (No narration)](http://img.youtube.com/vi/hdYn2XcSAek/0.jpg)](http://www.youtube.com/watch?v=hdYn2XcSAek "Demo Video")

## Prerequisites

- You will need access to the GPT-4 or ChatGPT API.
- Node.js and npm installed on your system.

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/searchbot9k.git
   ```
2. Navigate to the project folder:
   ```
   cd searchbot9k
   ```
3. Install the required dependencies:
   ```
   npm install
   ```
4. Copy the `sample.env` file and rename it to `.env`:
   ```
   cp sample.env .env
   ```
5. Add your GPT-4 or ChatGPT API key to the `.env` file.

## Usage

To start the application, simply run the following command in your terminal:

```
npm start -- "search query here"
```

This will launch the Electron application and open a web page where you can enter your queries and search for answers.

## Contributing

Pull requests are welcome! If you have any ideas for improvements, bug fixes, or new features, feel free to submit a pull request. Please make sure to test your changes before submitting.

## Known Issues

- The application might sometimes get into loops.
- Not all errors are handled yet, and the code could use a refactor.

## Larry's Lazy License

I have not yet determined a license yet.  I hold rights to the language of the actual prompt and the name SearchBot9k, but you can feel free to use the code here unless and until I figure out the legalities and pick a license, then you will have to follow that license from that point forward with future versions of the code / prompt.
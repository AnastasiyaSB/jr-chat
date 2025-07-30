import express, { Request, Response } from "express";
import cors from "cors";
import { Client } from "pg";

type Message = {
  "id": number,
  "username": string,
  "text": string,
  "timestamp": string,
};

const client = new Client();
const server = express();
const PORT = process.env.APP_PORT || 4000;

const messages: Message[] = [];

function* infiniteSequence() {
  let i = 0;
  while (true) {
    yield ++i;
  }
}

async function initServer() {
  if (!process.env.PGUSER) {
    throw new Error("Server cannot be started without database credentials provided in .env file");
  }

  const idIterator = infiniteSequence();

  server.use(cors());

  server.use(express.json());

  server.get("/", function (req: Request, res: Response) {
    res.status(200).json("Hello from backend");
  });

  server.get("/messages", function (req: Request, res: Response) {
    res.status(200).json([...messages].filter((m) =>
      Date.now() - +new Date(m.timestamp) < 1000 * 60 * 60 * 24 * 3
    ));
  });

  server.post("/messages", function (req: Request, res: Response) {
    const { username, text } = req.body;

    function validateForm(username: unknown, text: unknown) {
     if (typeof username !== "string") {
      return { field: "username", message: "Incorrect username (Username must be a string)" };
    }

     if (username.length < 2) {
      return { field: "username", message: "Incorrect length of username (too short)" };
    }

     if (username.length > 50) {
      return { field: "username", message: "Incorrect length of username (too long)" };
    }

    if (typeof text !== "string") {
      return { field: "text", message: "Incorrect message text (Message must be a string)" };
    }

    if (text.trim().length === 0) {
      return { field: "text", message: "Message cannot be empty" };
    }

    if (text.length < 1) {
      return { field: "text", message: "Incorrect length of message (too short)" };
    }

    if (text.length > 500) {
      return { field: "text", message: "Incorrect length of message (too long)" };
    }

    return;
  }

  const error = validateForm(username, text);
  if (error) {
    res.status(400).send({ message: error.message });
    return;
  }

    const newMessage = {
      id: idIterator.next().value as number,
      text,
      timestamp: new Date().toISOString(),
      username,
    };

    messages.push(newMessage);
    // INSERT INTO messages (user_id, text) VALUES (1, "Привет");
    res.status(201).send(newMessage);
  });

  await client.connect();

  server.listen(PORT, function () {
    console.log(`[server]: Server is running at http://localhost:${PORT}`);
  });
}

process.on("exit", async function () {
  await client.end();
});

initServer();

server.listen(PORT, function() {
  console.log(`[server]: Server is running at http://localhost:${PORT}`);
});

import express, { Request, Response } from "express";
import cors from "cors";
import { Client } from "pg";

type User = {
  "user_id": number,
  "username": string,
};

type Message = {
  "id": number,
  "username": string,
  "text": string,
  "timestamp": string,
};

const pgClient = new Client();
const server = express();
const PORT = process.env.APP_PORT || 4000;

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

  server.get("/users", async function (req: Request, res: Response) {
    const usersResponse = await pgClient.query("SELECT * FROM users");
    res.status(200).send(usersResponse.rows as User[]);
  });

  server.get("/messages", async function (req: Request, res: Response) {
    const messagesResponse = await pgClient.query(`SELECT 
      message_id as id,
      user_id as username,
      text,
      created_at as timestamp
    FROM messages`);

    res.status(200).send(messagesResponse.rows as Message[]);
  });

  server.post("/messages", async function (req: Request, res: Response) {
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
    
    try {
      const newMessageResponse = await pgClient.query(`INSERT INTO messages(
        text,
        user_id
      ) VALUES (
        '${text}',
        ${1 + Math.floor(Math.random() * 3)}
      )`);

      res.sendStatus(201);
    } catch (err) {
      res.sendStatus(500);
    }
  
  });

  await pgClient.connect();

  server.listen(PORT, function () {
    console.log(`[server]: Server is running at http://localhost:${PORT}`);
  });
}

process.on("exit", async function () {
  await pgClient.end();
});

initServer();

server.listen(PORT, function() {
  console.log(`[server]: Server is running at http://localhost:${PORT}`);
});

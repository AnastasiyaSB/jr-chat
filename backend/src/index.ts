import express, { Request, Response } from "express";
import cors from "cors";
import { Client } from "pg";

type User = {
  "user_id": number,
  "username": string,
};

type Message = {
  "id": number,
  "username": string | null,
  "text": string,
  "timestamp": string,
};

const pgClient = new Client();
const server = express();
const PORT = process.env.APP_PORT || 4000;

type ValidationError = {
  field: 'username' | 'text';
  message: string;
} | null;

function validateForm(inputType: 'username' | 'text', value: unknown): ValidationError {
  if (inputType === 'username') {
    if (typeof value !== 'string') {
      return { field: 'username', message: 'Username must be a string' };
    }
    if (value.length < 2) {
      return { field: 'username', message: 'Username is too short (min 2 chars)' };
    }
    if (value.length > 50) {
      return { field: 'username', message: 'Username is too long (max 50 chars)' };
    }
    if (!/^[A-Za-zА-Яа-яЁё]+$/.test(value)) {
      return { field: "username", message: "Username must contain only letters" };
    }
  }

  if (inputType === 'text') {
    if (typeof value !== 'string') {
      return { field: 'text', message: 'Message must be a string' };
    }
    if (value.trim().length === 0) {
      return { field: 'text', message: 'Message cannot be empty' };
    }
    if (value.length > 500) {
      return { field: 'text', message: 'Message is too long (max 500 chars)' };
    }
  }

  return null;
}

async function initServer() {
  if (!process.env.PGUSER) {
    throw new Error("Server cannot be started without database credentials provided in .env file");
  }

  server.use(cors());

  server.use(express.json());

  async function getUsers() {
    const usersResponse = await pgClient.query("SELECT * FROM users");
    return usersResponse.rows as User[];
  }

  async function getUserById(userId: number) {
    const usersResponse = await pgClient.query(`SELECT * FROM users WHERE user_id = $1::integer`, [userId]);

    if (usersResponse.rows.length > 0) {
      return usersResponse.rows[0] as User;
    }

    return null;
  }

  async function getUserByName(username: string) {
    const usersResponse = await pgClient.query(`SELECT * FROM users WHERE username = $1::text`, [username]);

    if (usersResponse.rows.length > 0) {
      return usersResponse.rows[0] as User;
    }

    return null;
  }

  server.get("/", function (req: Request, res: Response) {
    res.status(200).json("Hello from backend");
  });

  server.get("/users", async function (req: Request, res: Response) {
    const usersResponse = await getUsers();
    res.status(200).send(usersResponse);
  });

  server.post("/users", async function (req: Request, res: Response) {
    const { username } = req.body;

    const usernameError = validateForm('username', username);
    if (usernameError) {
      res.status(400).json({ message: usernameError.message });
      return;
    }

    const user = await getUserByName(username);

    if (user !== null) {
      res.status(200).send({
        "user_id": user.user_id,
      });
      return;
    }

    const newUserResponse = await pgClient.query(`INSERT INTO users(
      username
    ) VALUES (
      $1::text
    )`, [username]);

    if (newUserResponse.rowCount === 0) {
      res.sendStatus(500);
    }

    const newUser = await getUserByName(username);

    if (newUser === null) {
      res.sendStatus(500);
      return;
    }

    res.status(200).send({
      "user_id": newUser.user_id,
    });
  });

  server.get("/messages", async function (req: Request, res: Response) {
    const messagesResponse = await pgClient.query(`SELECT 
      messages.message_id AS id,
      users.username AS username,
      messages.text AS text,
      messages.created_at AS timestamp
    FROM messages
    LEFT JOIN users ON messages.user_id = users.user_id
    ORDER BY messages.created_at ASC`);

    res.status(200).send(messagesResponse.rows as Message[]);
  });

  server.post("/messages", async function (req: Request, res: Response) {
    const { user_id, text } = req.body;
    const user = await getUserById(user_id);

    if (user === null) {
      res.status(401).send({
        message: "Incorrect username",
      });

      return;
    }
    
    const textError = validateForm('text', text);
    if (textError) {
      res.status(400).json({ message: textError.message });
      return;
    }

    let newMessageResponse;
    
    try {
      newMessageResponse = await pgClient.query(`INSERT INTO messages(
        text,
        user_id
      ) VALUES ($1::text, $2::integer)`, [text, user_id]);

      res.sendStatus(201);
    } catch (err) {
      console.error(err);
      console.dir(newMessageResponse, {
        depth: 10
      });

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

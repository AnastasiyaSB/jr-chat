import express, { Request, Response } from "express";
import cors from "cors";

type Message = {
  "id": number,
  "username": string,
  "text": string,
  "timestamp": string,
};

const server = express();
const PORT = 4000;

const messages:Message[] = [];

function* infiniteSequence() {
  let i = 0;
  while (true) {
    yield ++i;
  }
}

const idIterator = infiniteSequence();

server.use(cors());
server.use(express.json());

server.get("/", function(req: Request, res: Response) {
  res.status(200).json("Hello from backend");
});

server.get("/messages", function(req: Request, res: Response) {
  res.status(200).json([...messages]);
});

server.post("/messages", function(req: Request, res: Response) {
  const { username, text } = req.body;

  // 2 Стратегии валидации
  //   1. Проверяются все ошибки и отправляются скопом
  //   2. Проверка останавливается на первой попавшейся ошибке и отправляется эта ошибка

  // *Некрасивенько, что в одном if проводятся сразу все проверки username
  // потому что сложно сформировать адекватное сообщение об ошибке
  // if (typeof username !== "string" || username.length < 2 || username.length > 50) {
  //   res.status(400).send({
  //     message: "Incorrect username",
  //   });

  //   return;
  // }

  // if (typeof text !== "string" || text.length < 1 || text.length > 500) {
  //   res.status(400).send({
  //     message: "Incorrect message text",
  //   });

  //   return;
  // }

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
  res.status(201).send(newMessage);
});

server.listen(PORT, function() {
  console.log(`[server]: Server is running at http://localhost:${PORT}`);
});

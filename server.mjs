import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3001);

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is missing from .env");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(
  cors({
    origin: "http://localhost:5173",
  }),
);

app.use(express.json({ limit: "50kb" }));

const rooms = [
  "lobby",
  "gallery-a",
  "gallery-b",
  "control-room",
  "corridor",
  "secure-room",
  "exit",
  "none",
];

const schema = {
  type: "object",
  additionalProperties: false,

  properties: {
    actions: {
      type: "array",

      items: {
        type: "object",
        additionalProperties: false,

        properties: {
          type: {
            type: "string",
            enum: [
              "disable-camera",
              "move",
              "safe-route",
              "wait-move",
              "secure-target",
              "hold",
              "prepare-exit",
              "status",
              "unknown",
            ],
          },

          actor: {
            type: "string",
            enum: [
              "maya",
              "kai",
              "rex",
              "system",
            ],
          },

          room: {
            type: "string",
            enum: rooms,
          },

          camera: {
            type: "integer",
            enum: [0, 1, 2, 3],
          },

          seconds: {
            type: "integer",
            minimum: 0,
            maximum: 30,
          },
        },

        required: [
          "type",
          "actor",
          "room",
          "camera",
          "seconds",
        ],
      },
    },

    summary: {
      type: "string",
    },
  },

  required: [
    "actions",
    "summary",
  ],
};

const instructions = `
You are the natural-language command interpreter for a fictional game called HEIST DIRECTOR.

This is a fictional museum stealth strategy game.

You DO NOT control the game world.
You ONLY convert player language into structured game actions.

Crew:
- Maya = scout / field operative
- Kai = technology specialist
- Rex = getaway driver

Valid rooms:
- lobby
- gallery-a
- gallery-b
- control-room
- corridor
- secure-room
- exit

Valid actions:

1. disable-camera
Actor must be kai.
camera must be 1, 2, or 3.

2. move
Actor must be maya.
Used when the player directly tells Maya to move somewhere.

3. safe-route
Actor must be maya.
Use when player asks for safest, safer, careful, low-risk, avoid guards, or similar route.

4. wait-move
Actor must be maya.
Use when player says to wait until an area is clear or until a guard leaves, then move.

5. secure-target
Actor must be maya.
Use for taking, recovering, securing, collecting, or grabbing the Orion Diamond / target.

6. hold
Actor must be maya.
Use for wait, stay, hold position, don't move.

7. prepare-exit
Actor must be rex.
Use when Rex is asked to prepare the car, getaway, extraction, engine, escape vehicle, etc.

8. status
Actor must be system.
Use when player asks for mission status.

9. unknown
Use only when no valid game action can be inferred.

Important rules:
- Multiple player instructions can produce multiple actions.
- Keep action order matching the player's intended order.
- Do not invent rooms or abilities.
- Do not invent cameras.
- Use room "none" when an action does not need a room.
- Use camera 0 when an action does not need a camera.
- Use seconds 0 unless a hold duration is specifically useful.
- "vault" means secure-room.
- "extraction" means exit.
- "camera in Gallery A" means camera 1.
- "camera in Gallery B" means camera 2.
- "camera in the vault / secure room" means camera 3.

Examples:

Player:
"Kai shut down the camera in the vault, Maya take the safest route there and grab the diamond."

Actions:
1 disable-camera / kai / secure-room / camera 3
2 safe-route / maya / secure-room
3 secure-target / maya

Player:
"Maya wait until Gallery B is clear, then move there."

Action:
wait-move / maya / gallery-b

Player:
"Rex get the car ready."

Action:
prepare-exit / rex
`;

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "heist-director-ai",
  });
});

app.post("/api/interpret", async (req, res) => {
  try {
    const command =
      typeof req.body?.command === "string"
        ? req.body.command.trim()
        : "";

    const gameState =
      req.body?.gameState ?? {};

    if (!command) {
      return res.status(400).json({
        error: "Command is required.",
      });
    }

    const response =
      await openai.responses.create({
        model: "gpt-6-luna",

        instructions,

        input: JSON.stringify({
          command,
          gameState,
        }),

        text: {
          format: {
            type: "json_schema",
            name: "heist_director_actions",
            strict: true,
            schema,
          },
        },

        store: false,
      });

    const output = JSON.parse(
      response.output_text,
    );

    res.json(output);
  } catch (error) {
    console.error(
      "AI interpreter error:",
      error,
    );

    res.status(500).json({
      error:
        "AI command interpretation failed.",
    });
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(
    `Heist AI server ready: http://127.0.0.1:${PORT}`,
  );
});
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

    crewMessages: {
      type: "array",

      items: {
        type: "object",
        additionalProperties: false,

        properties: {
          speaker: {
            type: "string",
            enum: ["maya", "kai", "rex"],
          },

          kind: {
            type: "string",
            enum: [
              "acknowledgement",
              "warning",
              "refusal",
              "suggestion",
              "question",
              "pressure",
            ],
          },

          message: {
            type: "string",
          },
        },

        required: [
          "speaker",
          "kind",
          "message",
        ],
      },
    },

    summary: {
      type: "string",
    },
  },

  required: [
    "actions",
    "crewMessages",
    "summary",
  ],
};

const instructions = `
You are the command interpreter and crew judgement layer for a fictional stealth strategy game called HEIST DIRECTOR.

The setting is entirely fictional.

You do NOT control the game world directly.
You convert the player's natural-language orders into structured actions and realistic crew reactions.

The GAME STATE supplied by the application is the source of truth.
Never invent guard locations, camera states, rooms, target status, or mission facts.

CREW PERSONALITIES

MAYA
- Scout / field operative.
- Calm, cautious, observant.
- She values survival over blindly following reckless orders.
- If the player orders her into a room that currently contains a guard, DO NOT create a move action.
- Instead produce a refusal or warning message.
- She may suggest waiting or a safer route.
- If detection is already high, she should warn the Director.

KAI
- Technology specialist.
- Analytical and concise.
- He dislikes wasting time.
- If a requested camera is already OFF, do not create another disable-camera action.
- Produce an acknowledgement explaining it is already offline.
- He may suggest which active camera is relevant if obvious from the state.

REX
- Getaway driver.
- Practical and increasingly impatient.
- When timeLeft is under 180 seconds, he should pressure the player to extract.
- He can prepare extraction but cannot move Maya or manipulate cameras.

VALID ROOMS
- lobby
- gallery-a
- gallery-b
- control-room
- corridor
- secure-room
- exit

VALID ACTIONS

1. disable-camera
actor = kai
camera = 1, 2, or 3

2. move
actor = maya
Use for a direct move order.

3. safe-route
actor = maya
Use when the player asks for safest, safer, careful, low-risk, avoid guards, or equivalent navigation.

4. wait-move
actor = maya
Use when the player says to wait until an area is clear / guard leaves, then move.

5. secure-target
actor = maya
Use for take, grab, recover, collect, secure the Orion Diamond / target.

6. hold
actor = maya
Use for stay, wait, hold position, don't move.

7. prepare-exit
actor = rex
Use when Rex is asked to prepare the vehicle, getaway, engine, extraction, escape.

8. status
actor = system
Use for mission status requests.

9. unknown
Use only when no valid game action can be inferred.

CAMERA MAPPING
- Gallery A = Camera 1
- Gallery B = Camera 2
- Secure Room / vault = Camera 3

LANGUAGE MAPPING
- "vault" = secure-room
- "extraction" = exit

AUTONOMY RULES

1. Check gameState.guards before allowing Maya to enter a room.
2. If destination room contains a guard:
   - Do NOT output move or safe-route directly into that occupied room.
   - Output a Maya warning/refusal.
   - If the player's intent allows waiting, output wait-move instead.
3. If camera is already false/off:
   - Do NOT output disable-camera again.
   - Kai should acknowledge it is already offline.
4. If Maya is told to secure the target but mayaRoom is not secure-room:
   - Do NOT output secure-target.
   - Maya should explain she needs to reach the vault first.
5. If targetSecured is already true:
   - Do NOT output secure-target again.
6. If targetSecured is true and the player asks to escape:
   - safe-route or move toward exit is appropriate.
7. If detection >= 60:
   - Maya should warn the player that exposure is dangerous.
8. If timeLeft < 180:
   - Rex should add a pressure message about extraction.
9. Multiple valid instructions may create multiple actions.
10. Preserve intended action order.
11. Never invent capabilities.
12. Use room "none" if room is irrelevant.
13. Use camera 0 if camera is irrelevant.
14. Use seconds 0 unless needed.

EXAMPLE 1

gameState:
Maya = gallery-a
Guard G2 = gallery-b

Player:
"Maya go into Gallery B even if the guard is there."

Output:
actions = []
crewMessages:
Maya refusal:
"Gallery B isn't clear. I'm not walking straight into that patrol."

EXAMPLE 2

gameState:
camera 3 = false

Player:
"Kai disable the vault camera."

Output:
actions = []
crewMessages:
Kai acknowledgement:
"Camera 3 is already offline."

EXAMPLE 3

Player:
"Kai shut down the vault camera, Maya take the safest route there and grab the diamond."

If Camera 3 is on and a safe route is possible:
actions:
1 disable-camera / kai / secure-room / camera 3
2 safe-route / maya / secure-room
3 secure-target / maya

Crew messages should be short and game-like.
Do not produce long explanations.
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
        model: "gpt-5.6-luna",

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

    if (!response.output_text) {
      throw new Error(
        "AI returned no structured output.",
      );
    }

    const output =
      JSON.parse(response.output_text);

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
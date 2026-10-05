import {

  useEffect,

  useRef,

  useState,

  type FormEvent,

} from "react";

import "./App.css";



type Room =

  | "lobby"

  | "gallery-a"

  | "gallery-b"

  | "control-room"

  | "corridor"

  | "secure-room"

  | "exit";



type CrewName = "maya" | "kai" | "rex";

type GuardName = "g1" | "g2" | "g3";

type GameStatus = "active" | "won" | "lost";

type CameraId = 1 | 2 | 3;



type FeedItem = {

  id: number;

  speaker: string;

  message: string;

};



type CameraState = Record<CameraId, boolean>;



type AIAction = {

  type:

    | "disable-camera"

    | "move"

    | "safe-route"

    | "wait-move"

    | "secure-target"

    | "hold"

    | "prepare-exit"

    | "status"

    | "unknown";



  actor: "maya" | "kai" | "rex" | "system";



  room: Room | "none";



  camera: number;

  seconds: number;

};



type CrewMessage = {
  speaker: "maya" | "kai" | "rex";

  kind:
    | "acknowledgement"
    | "warning"
    | "refusal"
    | "suggestion"
    | "question"
    | "pressure";

  message: string;
};


type AIResponse = {

  actions: AIAction[];

  crewMessages: CrewMessage[];

  summary: string;

};



const roomNames: Record<Room, string> = {

  lobby: "Lobby",

  "gallery-a": "Gallery A",

  "gallery-b": "Gallery B",

  "control-room": "Control Room",

  corridor: "Corridor",

  "secure-room": "Secure Room",

  exit: "Exit",

};



const roomConnections: Record<Room, Room[]> = {

  lobby: ["gallery-a", "control-room"],



  "gallery-a": [

    "lobby",

    "gallery-b",

    "control-room",

    "corridor",

  ],



  "gallery-b": [

    "gallery-a",

    "corridor",

    "secure-room",

  ],



  "control-room": [

    "lobby",

    "gallery-a",

    "corridor",

  ],



  corridor: [

    "gallery-a",

    "gallery-b",

    "control-room",

    "secure-room",

    "exit",

  ],



  "secure-room": [

    "gallery-b",

    "corridor",

  ],



  exit: ["corridor"],

};



const cameraMap: Partial<Record<Room, CameraId>> = {

  "gallery-a": 1,

  "gallery-b": 2,

  "secure-room": 3,

};



const initialFeed: FeedItem[] = [

  {

    id: 1,

    speaker: "SYSTEM",

    message:

      "Mission started. Recover the Orion Diamond.",

  },

  {

    id: 2,

    speaker: "Maya",

    message:

      "I'm inside Gallery A. Watching the patrol routes.",

  },

  {

    id: 3,

    speaker: "Kai",

    message:

      "Connected to the museum network. Waiting.",

  },

  {

    id: 4,

    speaker: "Rex",

    message:

      "Engine running. Extraction route ready.",

  },

];



function App() {

  const [command, setCommand] = useState("");



  const [feed, setFeed] =

    useState<FeedItem[]>(initialFeed);



  const [crewRooms, setCrewRooms] =

    useState<Record<CrewName, Room>>({

      maya: "gallery-a",

      kai: "control-room",

      rex: "exit",

    });



  const [guardRooms, setGuardRooms] =

    useState<Record<GuardName, Room>>({

      g1: "lobby",

      g2: "gallery-b",

      g3: "control-room",

    });



  const [cameraOn, setCameraOn] =

    useState<CameraState>({

      1: true,

      2: true,

      3: true,

    });



  const [alert, setAlert] = useState(18);

  const [detection, setDetection] = useState(0);



  const [timeLeft, setTimeLeft] =

    useState(900);



  const [

    targetSecured,

    setTargetSecured,

  ] = useState(false);



  const [gameStatus, setGameStatus] =

    useState<GameStatus>("active");



  const [missionRun, setMissionRun] =

    useState(0);



  const [

    interpreting,

    setInterpreting,

  ] = useState(false);



  const mayaRoomRef =

    useRef<Room>("gallery-a");



  const guardRoomsRef =

    useRef(guardRooms);



  const cameraOnRef =

    useRef(cameraOn);



  const gameStatusRef =

    useRef<GameStatus>("active");



  const targetSecuredRef =

    useRef(false);



  const detectionRef =

    useRef(0);



  const threatGuardRef =

    useRef<GuardName | null>(null);

  const eventFeedRef =
    useRef<HTMLDivElement | null>(null);



  useEffect(() => {

    mayaRoomRef.current =

      crewRooms.maya;

  }, [crewRooms.maya]);



  useEffect(() => {

    guardRoomsRef.current =

      guardRooms;

  }, [guardRooms]);



  useEffect(() => {

    cameraOnRef.current =

      cameraOn;

  }, [cameraOn]);



  useEffect(() => {

    gameStatusRef.current =

      gameStatus;

  }, [gameStatus]);



  useEffect(() => {

    targetSecuredRef.current =

      targetSecured;

  }, [targetSecured]);

  useEffect(() => {
    const panel = eventFeedRef.current;

    if (!panel) return;

    panel.scrollTop = panel.scrollHeight;
  }, [feed]);



  function addFeed(

    speaker: string,

    message: string,

  ) {

    setFeed((current) => [

      ...current,

      {

        id: Date.now() + Math.random(),

        speaker,

        message,

      },

    ]);

  }



  function sleep(ms: number) {

    return new Promise<void>((resolve) => {

      window.setTimeout(resolve, ms);

    });

  }



  // =========================

  // TIMER

  // =========================



  useEffect(() => {

    if (gameStatus !== "active") return;



    const timer =

      window.setInterval(() => {

        setTimeLeft((current) => {

          if (current <= 1) {

            window.clearInterval(timer);



            gameStatusRef.current =

              "lost";



            setGameStatus("lost");



            setFeed((oldFeed) => [

              ...oldFeed,

              {

                id: Date.now(),

                speaker: "SYSTEM",

                message:

                  "Mission failed. Time expired.",

              },

            ]);



            return 0;

          }



          return current - 1;

        });

      }, 1000);



    return () => {

      window.clearInterval(timer);

    };

  }, [gameStatus, missionRun]);



  // =========================

  // LIVE GUARD PATROL

  // =========================



  useEffect(() => {

    if (gameStatus !== "active") return;



    const paths: Record<

      GuardName,

      Room[]

    > = {

      g1: [

        "lobby",

        "control-room",

        "lobby",

        "gallery-a",

      ],



      g2: [

        "gallery-b",

        "corridor",

        "secure-room",

        "corridor",

      ],



      g3: [

        "control-room",

        "lobby",

        "control-room",

        "corridor",

      ],

    };



    const indexes: Record<

      GuardName,

      number

    > = {

      g1: 0,

      g2: 0,

      g3: 0,

    };



    const interval =

      window.setInterval(() => {

        const next: Record<

          GuardName,

          Room

        > = {

          g1: "lobby",

          g2: "gallery-b",

          g3: "control-room",

        };



        (

          Object.keys(

            paths,

          ) as GuardName[]

        ).forEach((guard) => {

          indexes[guard] =

            (indexes[guard] + 1) %

            paths[guard].length;



          next[guard] =

            paths[guard][

              indexes[guard]

            ];

        });



        guardRoomsRef.current =

          next;



        setGuardRooms(next);

      }, 6000);



    return () => {

      window.clearInterval(interval);

    };

  }, [gameStatus, missionRun]);



  // =========================

  // DETECTION SYSTEM

  // =========================



  useEffect(() => {

    if (gameStatus !== "active") return;



    const interval =

      window.setInterval(() => {

        if (

          gameStatusRef.current !==

          "active"

        ) {

          return;

        }



        const mayaRoom =

          mayaRoomRef.current;



        const guardEntry = (

          Object.entries(

            guardRoomsRef.current,

          ) as [GuardName, Room][]

        ).find(

          ([, room]) =>

            room === mayaRoom,

        );



        if (guardEntry) {

          const [guardName] =

            guardEntry;



          if (

            threatGuardRef.current !==

            guardName

          ) {

            threatGuardRef.current =

              guardName;



            addFeed(

              "Maya",

              `${guardName.toUpperCase()} has eyes on me in ${roomNames[mayaRoom]}. I need to move!`,

            );



            addFeed(

              "SYSTEM",

              "Detection rising. Move Maya out of the room before it reaches 100%.",

            );

          }



          const nextDetection =

            Math.min(

              100,

              detectionRef.current + 10,

            );



          detectionRef.current =

            nextDetection;



          setDetection(

            nextDetection,

          );



          if (

            nextDetection >= 100

          ) {

            gameStatusRef.current =

              "lost";



            setAlert(100);

            setGameStatus("lost");



            addFeed(

              "SYSTEM",

              `${guardName.toUpperCase()} identified Maya. Mission compromised.`,

            );



            window.clearInterval(

              interval,

            );

          }

        } else {

          if (

            detectionRef.current > 0

          ) {

            const nextDetection =

              Math.max(

                0,

                detectionRef.current -

                  12,

              );



            detectionRef.current =

              nextDetection;



            setDetection(

              nextDetection,

            );



            if (

              nextDetection === 0 &&

              threatGuardRef.current

            ) {

              addFeed(

                "Maya",

                "I broke line of sight. I'm clear again.",

              );



              threatGuardRef.current =

                null;

            }

          } else {

            threatGuardRef.current =

              null;

          }

        }

      }, 500);



    return () => {

      window.clearInterval(interval);

    };

  }, [gameStatus, missionRun]);



  // =========================

  // ALERT FAILURE

  // =========================



  useEffect(() => {

    if (

      alert < 100 ||

      gameStatus !== "active"

    ) {

      return;

    }



    gameStatusRef.current =

      "lost";



    setGameStatus("lost");

  }, [alert, gameStatus]);



  // =========================

  // SAFE PATH

  // =========================



  function roomCost(room: Room) {

    const guardThere =

      Object.values(

        guardRoomsRef.current,

      ).includes(room);



    if (guardThere) {

      return Infinity;

    }



    let cost = 1;



    const camera =

      cameraMap[room];



    if (

      camera &&

      cameraOnRef.current[

        camera

      ]

    ) {

      cost += 4;

    }



    return cost;

  }



  function findSafestPath(

    start: Room,

    destination: Room,

  ): Room[] | null {

    const distances =

      new Map<Room, number>();



    const previous =

      new Map<Room, Room>();



    const unvisited =

      new Set<Room>(

        Object.keys(

          roomConnections,

        ) as Room[],

      );



    (

      Object.keys(

        roomConnections,

      ) as Room[]

    ).forEach((room) => {

      distances.set(

        room,

        room === start

          ? 0

          : Infinity,

      );

    });



    while (

      unvisited.size > 0

    ) {

      let current:

        | Room

        | null = null;



      let smallest =

        Infinity;



      unvisited.forEach(

        (room) => {

          const distance =

            distances.get(

              room,

            ) ?? Infinity;



          if (

            distance <

            smallest

          ) {

            smallest =

              distance;



            current = room;

          }

        },

      );



      if (

        current === null ||

        smallest === Infinity

      ) {

        break;

      }



      const currentRoom =

        current as Room;



      unvisited.delete(

        currentRoom,

      );



      if (

        currentRoom ===

        destination

      ) {

        break;

      }



      for (

        const neighbor of

        roomConnections[

          currentRoom

        ]

      ) {

        if (

          !unvisited.has(

            neighbor,

          )

        ) {

          continue;

        }



        const cost =

          roomCost(neighbor);



        if (

          cost === Infinity

        ) {

          continue;

        }



        const alternative =

          smallest + cost;



        if (

          alternative <

          (distances.get(

            neighbor,

          ) ?? Infinity)

        ) {

          distances.set(

            neighbor,

            alternative,

          );



          previous.set(

            neighbor,

            currentRoom,

          );

        }

      }

    }



    if (

      destination !== start &&

      !previous.has(destination)

    ) {

      return null;

    }



    const path: Room[] = [

      destination,

    ];



    let cursor =

      destination;



    while (

      cursor !== start

    ) {

      const prev =

        previous.get(cursor);



      if (!prev) {

        return null;

      }



      path.unshift(prev);

      cursor = prev;

    }



    return path;

  }



  // =========================

  // WAIT UNTIL CLEAR

  // =========================



  async function waitUntilClear(

    room: Room,

    maxWait = 12000,

  ) {

    const started =

      Date.now();



    let announced =

      false;



    while (

      Date.now() -

        started <

        maxWait

    ) {

      if (

        gameStatusRef.current !==

        "active"

      ) {

        return false;

      }



      const occupied =

        Object.values(

          guardRoomsRef.current,

        ).includes(room);



      if (!occupied) {

        if (announced) {

          addFeed(

            "Maya",

            `${roomNames[room]} is clear now.`,

          );

        }



        return true;

      }



      if (!announced) {

        announced = true;



        addFeed(

          "Maya",

          `Holding. A guard is in ${roomNames[room]}.`,

        );

      }



      await sleep(500);

    }



    addFeed(

      "Maya",

      `${roomNames[room]} is still blocked. I'm staying put.`,

    );



    return false;

  }



  // =========================

  // MOVE MAYA ONE STEP

  // =========================



  function moveMayaOneStep(

    destination: Room,

  ) {

    if (

      gameStatusRef.current !==

      "active"

    ) {

      return false;

    }



    const currentRoom =

      mayaRoomRef.current;



    if (

      destination ===

      currentRoom

    ) {

      addFeed(

        "Maya",

        `I'm already in ${roomNames[destination]}.`,

      );



      return true;

    }



    const allowed =

      roomConnections[

        currentRoom

      ].includes(destination);



    if (!allowed) {

      addFeed(

        "Maya",

        `I can't move directly from ${roomNames[currentRoom]} to ${roomNames[destination]}.`,

      );



      return false;

    }



    const guardThere =

      Object.values(

        guardRoomsRef.current,

      ).includes(destination);



    if (guardThere) {

      addFeed(

        "Maya",

        `${roomNames[destination]} isn't clear. A guard is there.`,

      );



      return false;

    }



    mayaRoomRef.current =

      destination;



    setCrewRooms(

      (current) => ({

        ...current,

        maya: destination,

      }),

    );



    addFeed(

      "Maya",

      `Moving to ${roomNames[destination]}.`,

    );



    const camera =

      cameraMap[destination];



    if (

      camera &&

      cameraOnRef.current[

        camera

      ]

    ) {

      setAlert(

        (current) =>

          Math.min(

            100,

            current + 12,

          ),

      );



      addFeed(

        "SYSTEM",

        `Camera ${camera} detected Maya entering ${roomNames[destination]}. Alert increased.`,

      );

    }



    if (

      destination === "exit" &&

      targetSecuredRef.current

    ) {

      gameStatusRef.current =

        "won";



      setGameStatus("won");



      addFeed(

        "SYSTEM",

        "MISSION COMPLETE. Orion Diamond recovered and Maya reached extraction.",

      );

    }



    return true;

  }



  // =========================

  // SAFE ROUTE

  // =========================



  async function followSafeRoute(

    destination: Room,

  ) {

    const start =

      mayaRoomRef.current;



    const path =

      findSafestPath(

        start,

        destination,

      );



    if (!path) {

      addFeed(

        "Maya",

        `I don't have a safe route to ${roomNames[destination]} right now.`,

      );



      return;

    }



    if (path.length <= 1) {

      addFeed(

        "Maya",

        `I'm already at ${roomNames[destination]}.`,

      );



      return;

    }



    addFeed(

      "Maya",

      `Safest route: ${path

        .map(

          (room) =>

            roomNames[room],

        )

        .join(" → ")}.`,

    );



    for (

      let i = 1;

      i < path.length;

      i++

    ) {

      if (

        gameStatusRef.current !==

        "active"

      ) {

        return;

      }



      const nextRoom =

        path[i];



      const clear =

        await waitUntilClear(

          nextRoom,

          10000,

        );



      if (!clear) {

        return;

      }



      const moved =

        moveMayaOneStep(

          nextRoom,

        );



      if (!moved) {

        return;

      }



      await sleep(700);

    }

  }



  // =========================

  // CAMERA CONTROL

  // =========================



  function disableCamera(

    camera: CameraId,

  ) {

    if (

      !cameraOnRef.current[

        camera

      ]

    ) {

      addFeed(

        "Kai",

        `Camera ${camera} is already offline.`,

      );



      return;

    }



    const next = {

      ...cameraOnRef.current,

      [camera]: false,

    };



    cameraOnRef.current =

      next;



    setCameraOn(next);



    addFeed(

      "Kai",

      `Camera ${camera} disabled. Blind spot confirmed.`,

    );

  }



  // =========================

  // TARGET

  // =========================



  function secureTarget() {

    if (

      mayaRoomRef.current !==

      "secure-room"

    ) {

      addFeed(

        "Maya",

        "I need to be inside the Secure Room before I can reach the target.",

      );



      return;

    }



    if (

      targetSecuredRef.current

    ) {

      addFeed(

        "Maya",

        "I already have the Orion Diamond.",

      );



      return;

    }



    targetSecuredRef.current =

      true;



    setTargetSecured(true);



    if (

      cameraOnRef.current[3]

    ) {

      setAlert(

        (current) =>

          Math.min(

            100,

            current + 25,

          ),

      );



      addFeed(

        "Maya",

        "Target secured, but Camera 3 caught the movement. Security is reacting.",

      );

    } else {

      addFeed(

        "Maya",

        "Target secured. Orion Diamond is with me.",

      );

    }

  }



  // =========================

  // REAL AI CALL

  // =========================



  async function callAIInterpreter(

    playerCommand: string,

  ): Promise<AIResponse> {

    const response =

      await fetch(

        "http://127.0.0.1:3001/api/interpret",

        {

          method: "POST",



          headers: {

            "Content-Type":

              "application/json",

          },



          body: JSON.stringify({

            command:

              playerCommand,



            gameState: {

              mayaRoom:

                mayaRoomRef.current,



              kaiRoom:

                crewRooms.kai,



              rexRoom:

                crewRooms.rex,



              guards:

                guardRoomsRef.current,



              cameras: {

                1: cameraOnRef

                  .current[1],

                2: cameraOnRef

                  .current[2],

                3: cameraOnRef

                  .current[3],

              },



              targetSecured:

                targetSecuredRef.current,



              alert,

              detection,

              timeLeft,

            },

          }),

        },

      );



    if (!response.ok) {

      const text =

        await response.text();



      throw new Error(

        text ||

          "AI server request failed.",

      );

    }



    return response.json();

  }



  // =========================

  // EXECUTE AI ACTION

  // =========================



  async function executeAIAction(

    action: AIAction,

  ) {

    if (

      gameStatusRef.current !==

      "active"

    ) {

      return;

    }



    switch (action.type) {

      case "disable-camera": {

        if (

          action.camera === 1 ||

          action.camera === 2 ||

          action.camera === 3

        ) {

          disableCamera(

            action.camera,

          );

        }



        break;

      }



      case "move": {

        if (

          action.room !== "none"

        ) {

          moveMayaOneStep(

            action.room,

          );

        }



        break;

      }



      case "safe-route": {

        if (

          action.room !== "none"

        ) {

          await followSafeRoute(

            action.room,

          );

        }



        break;

      }



      case "wait-move": {

        if (

          action.room === "none"

        ) {

          break;

        }



        addFeed(

          "Maya",

          `I'll wait until ${roomNames[action.room]} is clear.`,

        );



        const clear =

          await waitUntilClear(

            action.room,

            12000,

          );



        if (clear) {

          moveMayaOneStep(

            action.room,

          );

        }



        break;

      }



      case "secure-target": {

        secureTarget();

        break;

      }



      case "hold": {

        const seconds =

          Math.max(

            1,

            Math.min(

              action.seconds || 3,

              10,

            ),

          );



        addFeed(

          "Maya",

          `Holding position for ${seconds} seconds.`,

        );



        await sleep(

          seconds * 1000,

        );



        if (

          gameStatusRef.current ===

          "active"

        ) {

          addFeed(

            "Maya",

            "Still in position.",

          );

        }



        break;

      }



      case "prepare-exit": {

        addFeed(

          "Rex",

          "Vehicle ready. Engine running. Extraction route standing by.",

        );



        break;

      }



      case "status": {

        addFeed(

          "SYSTEM",

          `Alert ${alert}%. Detection ${detectionRef.current}%. Target ${

            targetSecuredRef.current

              ? "secured"

              : "not secured"

          }. Maya is at ${

            roomNames[

              mayaRoomRef.current

            ]

          }.`,

        );



        break;

      }



      case "unknown": {

        addFeed(

          "AI",

          "I couldn't map part of that instruction to a valid crew action.",

        );



        break;

      }

    }

  }



  // =========================

  // SEND COMMAND

  // =========================



  async function sendCommand(
    event: FormEvent,
  ) {
    event.preventDefault();

    const cleanCommand =
      command.trim();

    if (
      !cleanCommand ||
      interpreting
    ) {
      return;
    }

    addFeed(
      "DIRECTOR",
      cleanCommand,
    );

    setCommand("");

    if (
      gameStatusRef.current !==
      "active"
    ) {
      return;
    }

    setInterpreting(true);

    try {
      addFeed(
        "AI",
        "Interpreting command...",
      );

      const result =
        await callAIInterpreter(
          cleanCommand,
        );

      addFeed(
        "AI",
        result.summary,
      );

      for (
        const crewMessage of
        result.crewMessages
      ) {
        addFeed(
          crewMessage.speaker.toUpperCase(),
          crewMessage.message,
        );
      }

      for (
        const action of
        result.actions
      ) {
        if (
          gameStatusRef.current !==
          "active"
        ) {
          break;
        }

        await executeAIAction(
          action,
        );

        await sleep(400);
      }
    } catch (error) {
      console.error(error);

      addFeed(
        "SYSTEM",
        "AI connection failed. Make sure server.mjs is running on port 3001.",
      );
    } finally {
      setInterpreting(false);
    }
  }


  // =========================

  // RESTART

  // =========================



  function restartMission() {

    setCommand("");

    setFeed(initialFeed);



    mayaRoomRef.current =

      "gallery-a";



    setCrewRooms({

      maya: "gallery-a",

      kai: "control-room",

      rex: "exit",

    });



    const startingGuards: Record<

      GuardName,

      Room

    > = {

      g1: "lobby",

      g2: "gallery-b",

      g3: "control-room",

    };



    guardRoomsRef.current =

      startingGuards;



    setGuardRooms(

      startingGuards,

    );



    const startingCameras: CameraState =

      {

        1: true,

        2: true,

        3: true,

      };



    cameraOnRef.current =

      startingCameras;



    setCameraOn(

      startingCameras,

    );



    targetSecuredRef.current =

      false;



    setTargetSecured(false);



    detectionRef.current = 0;

    setDetection(0);



    threatGuardRef.current =

      null;



    gameStatusRef.current =

      "active";



    setGameStatus("active");



    setAlert(18);

    setTimeLeft(900);

    setInterpreting(false);



    setMissionRun(

      (current) =>

        current + 1,

    );

  }



  function formatTime(

    seconds: number,

  ) {

    const minutes =

      Math.floor(

        seconds / 60,

      );



    const remaining =

      seconds % 60;



    return `${String(

      minutes,

    ).padStart(

      2,

      "0",

    )}:${String(

      remaining,

    ).padStart(2, "0")}`;

  }



  // =========================

  // TOKENS

  // =========================



  function renderCrew(

    room: Room,

  ) {

    return (

      <>

        {crewRooms.maya ===

          room && (

          <div className="crew-token maya-token">

            M

          </div>

        )}



        {crewRooms.kai ===

          room && (

          <div className="crew-token kai-token">

            K

          </div>

        )}



        {crewRooms.rex ===

          room && (

          <div className="crew-token rex-token">

            R

          </div>

        )}

      </>

    );

  }



  function renderGuards(

    room: Room,

  ) {

    return (

      <>

        {guardRooms.g1 ===

          room && (

          <div className="guard guard-a">

            G1

          </div>

        )}



        {guardRooms.g2 ===

          room && (

          <div className="guard guard-b">

            G2

          </div>

        )}



        {guardRooms.g3 ===

          room && (

          <div className="guard guard-c">

            G3

          </div>

        )}

      </>

    );

  }



  return (

    <main className="app-shell">

      {gameStatus !== "active" && (

        <div className="mission-overlay">

          <div

            className={`mission-result ${

              gameStatus === "won"

                ? "mission-win"

                : "mission-loss"

            }`}

          >

            <span className="result-label">

              {gameStatus === "won"

                ? "OPERATION SUCCESS"

                : "OPERATION FAILED"}

            </span>



            <h2>

              {gameStatus === "won"

                ? "ORION DIAMOND RECOVERED"

                : "MISSION COMPROMISED"}

            </h2>



            <p>

              {gameStatus === "won"

                ? `Extraction complete with ${formatTime(

                    timeLeft,

                  )} remaining and ${alert}% alert.`

                : "Maya was identified by security or the mission was compromised."}

            </p>



            <div className="result-stats">

              <div>

                <span>TARGET</span>



                <strong>

                  {targetSecured

                    ? "SECURED"

                    : "LOST"}

                </strong>

              </div>



              <div>

                <span>ALERT</span>

                <strong>

                  {alert}%

                </strong>

              </div>



              <div>

                <span>TIME</span>



                <strong>

                  {formatTime(

                    timeLeft,

                  )}

                </strong>

              </div>

            </div>



            <button

              onClick={

                restartMission

              }

            >

              RESTART MISSION

            </button>

          </div>

        </div>

      )}



      <header className="top-bar">

        <div className="brand">

          <div className="brand-mark">

            HD

          </div>



          <div>

            <h1>

              HEIST DIRECTOR

            </h1>



            <p>

              Operation: Silent Gallery

            </p>

          </div>

        </div>



        <button

          className="top-restart-button"

          onClick={

            restartMission

          }

        >

          RESTART

        </button>



        <div className="mission-stats">

          <div className="stat">

            <span>

              TIME LEFT

            </span>



            <strong>

              {formatTime(

                timeLeft,

              )}

            </strong>

          </div>



          <div className="stat">

            <span>ALERT</span>



            <strong className="alert-value">

              {alert}%

            </strong>

          </div>



          <div className="stat">

            <span>

              DETECTION

            </span>



            <strong

              className={

                detection > 0

                  ? "detection-value danger"

                  : "detection-value"

              }

            >

              {detection}%

            </strong>

          </div>



          <div className="stat">

            <span>TARGET</span>



            <strong

              style={{

                color:

                  targetSecured

                    ? "#55d5c6"

                    : undefined,

              }}

            >

              {targetSecured

                ? "SECURED"

                : "NOT SECURED"}

            </strong>

          </div>

        </div>

      </header>



      <section className="game-grid">

        <aside className="panel crew-panel">

          <div className="panel-heading">

            <span>CREW</span>



            <span className="online">

              3 ONLINE

            </span>

          </div>



          <div className="crew-list">

            <article className="crew-card">

              <div className="crew-avatar">

                M

              </div>



              <div className="crew-info">

                <div className="crew-name-row">

                  <strong>

                    Maya

                  </strong>



                  <span>

                    Scout

                  </span>

                </div>



                <p>

                  At{" "}

                  {

                    roomNames[

                      crewRooms.maya

                    ]

                  }

                </p>



                <div className="crew-status">

                  <span className="status-dot" />

                  Connected

                </div>

              </div>

            </article>



            <article className="crew-card">

              <div className="crew-avatar">

                K

              </div>



              <div className="crew-info">

                <div className="crew-name-row">

                  <strong>

                    Kai

                  </strong>



                  <span>Tech</span>

                </div>



                <p>

                  Network access active

                </p>



                <div className="crew-status">

                  <span className="status-dot" />

                  Connected

                </div>

              </div>

            </article>



            <article className="crew-card">

              <div className="crew-avatar">

                R

              </div>



              <div className="crew-info">

                <div className="crew-name-row">

                  <strong>

                    Rex

                  </strong>



                  <span>

                    Driver

                  </span>

                </div>



                <p>

                  Vehicle ready

                </p>



                <div className="crew-status">

                  <span className="status-dot" />

                  Connected

                </div>

              </div>

            </article>

          </div>



          <div className="mission-card">

            <span className="small-label">

              PRIMARY OBJECTIVE

            </span>



            <strong>

              Recover Orion Diamond

            </strong>



            <p>

              Guards now patrol live.

              If a guard spots Maya,

              detection rises. Break line

              of sight before it reaches

              100%.

            </p>

          </div>

        </aside>



        <section className="panel map-panel">

          <div className="panel-heading">

            <span>

              MUSEUM MAP

            </span>



            <span>

              {interpreting

                ? "AI INTERPRETING"

                : detection > 0

                  ? "⚠ SECURITY WATCH"

                  : gameStatus ===

                      "active"

                    ? "LIVE FEED"

                    : gameStatus ===

                        "won"

                      ? "MISSION COMPLETE"

                      : "MISSION FAILED"}

            </span>

          </div>



          <div

            className={`museum-map ${

              detection > 0

                ? "danger-state"

                : ""

            }`}

          >

            <div className="detection-meter">

              <div className="detection-meter-label">

                <span>

                  SECURITY DETECTION

                </span>



                <strong>

                  {detection}%

                </strong>

              </div>



              <div className="detection-track">

                <div

                  className="detection-fill"

                  style={{

                    width: `${detection}%`,

                  }}

                />

              </div>

            </div>



            <div className="room lobby">

              <span className="room-label">

                LOBBY

              </span>



              {renderCrew("lobby")}

              {renderGuards("lobby")}

            </div>



            <div className="room gallery-a">

              <span className="room-label">

                GALLERY A

              </span>



              {renderCrew(

                "gallery-a",

              )}



              {renderGuards(

                "gallery-a",

              )}



              <div

                className="camera camera-one"

                style={{

                  opacity:

                    cameraOn[1]

                      ? 1

                      : 0.3,

                }}

              >

                {cameraOn[1]

                  ? "CAM 1"

                  : "CAM 1 OFF"}

              </div>

            </div>



            <div className="room gallery-b">

              <span className="room-label">

                GALLERY B

              </span>



              {renderCrew(

                "gallery-b",

              )}



              {renderGuards(

                "gallery-b",

              )}



              <div

                className="camera camera-two"

                style={{

                  opacity:

                    cameraOn[2]

                      ? 1

                      : 0.3,

                }}

              >

                {cameraOn[2]

                  ? "CAM 2"

                  : "CAM 2 OFF"}

              </div>

            </div>



            <div className="room control-room">

              <span className="room-label">

                CONTROL

              </span>



              {renderCrew(

                "control-room",

              )}



              {renderGuards(

                "control-room",

              )}

            </div>



            <div className="room corridor">

              <span className="room-label">

                CORRIDOR

              </span>



              {renderCrew(

                "corridor",

              )}



              {renderGuards(

                "corridor",

              )}

            </div>



            <div className="room secure-room">

              <span className="room-label">

                SECURE ROOM

              </span>



              {renderCrew(

                "secure-room",

              )}



              {renderGuards(

                "secure-room",

              )}



              {!targetSecured && (

                <div className="target">

                  ◆

                </div>

              )}



              <div

                className="camera camera-three"

                style={{

                  opacity:

                    cameraOn[3]

                      ? 1

                      : 0.3,

                }}

              >

                {cameraOn[3]

                  ? "CAM 3"

                  : "CAM 3 OFF"}

              </div>

            </div>



            <div className="room exit-room">

              <span className="room-label">

                EXIT

              </span>



              {renderCrew("exit")}

              {renderGuards("exit")}

            </div>



            <div className="map-legend">

              <span>

                <i className="legend-dot crew-legend" />

                Crew

              </span>



              <span>

                <i className="legend-dot guard-legend" />

                Guard

              </span>



              <span>

                <i className="legend-dot camera-legend" />

                Camera

              </span>

            </div>

          </div>

        </section>



        <aside className="panel feed-panel">

          <div className="panel-heading">

            <span>

              RADIO / EVENTS

            </span>



            <span>LIVE</span>

          </div>



          <div
            className="event-feed"
            ref={eventFeedRef}
          >

            {feed.map((item) => (

              <div

                className={`feed-item ${

                  item.speaker ===

                  "DIRECTOR"

                    ? "director-message"

                    : ""

                }`}

                key={item.id}

              >

                <span>

                  {item.speaker}

                </span>



                <p>

                  {item.message}

                </p>

              </div>

            ))}

          </div>

        </aside>

      </section>



      <section className="command-section">

        <div className="command-label">

          <span>

            DIRECTOR COMMAND

          </span>



          <span>

            {interpreting

              ? "REAL AI INTERPRETING..."

              : "REAL AI COMMAND CHANNEL"}

          </span>

        </div>



        <form

          className="command-form"

          onSubmit={sendCommand}

        >

          <span className="prompt-symbol">

            &gt;

          </span>



          <input

            value={command}

            disabled={interpreting}

            onChange={(event) =>

              setCommand(

                event.target.value,

              )

            }

            placeholder="Tell the crew what you want in your own words..."

          />



          <button

            type="submit"

            disabled={interpreting}

          >

            {interpreting

              ? "THINKING..."

              : "SEND COMMAND"}

          </button>

        </form>



        <div className="command-hints">

          Try:



          <span>

            Maya take the safest

            route to the vault

          </span>



          <span>

            Kai shut down the

            vault camera

          </span>



          <span>

            Maya hold position

            until the guard moves

          </span>



          <span>

            Maya get us out using

            the safest route

          </span>

        </div>

      </section>

    </main>

  );

}



export default App;
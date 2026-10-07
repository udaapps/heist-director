import { useEffect, useRef, useState, type FormEvent } from "react";
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
  "gallery-a": ["lobby", "gallery-b", "control-room", "corridor"],
  "gallery-b": ["gallery-a", "corridor", "secure-room"],
  "control-room": ["lobby", "gallery-a", "corridor"],
  corridor: ["gallery-a", "gallery-b", "control-room", "secure-room", "exit"],
  "secure-room": ["gallery-b", "corridor"],
  exit: ["corridor"],
};

const cameraMap: Partial<Record<Room, CameraId>> = {
  "gallery-a": 1,
  "gallery-b": 2,
  "secure-room": 3,
};

const initialFeed: FeedItem[] = [
  { id: 1, speaker: "SYSTEM", message: "Mission started. Recover the Orion Diamond." },
  { id: 2, speaker: "Maya", message: "I'm inside Gallery A. Watching the patrol routes." },
  { id: 3, speaker: "Kai", message: "Connected to the museum network. Waiting." },
  { id: 4, speaker: "Rex", message: "Engine running. Extraction route ready." },
];

const initialGuards: Record<GuardName, Room> = {
  g1: "lobby",
  g2: "gallery-b",
  g3: "control-room",
};

const guardPaths: Record<GuardName, Room[]> = {
  g1: ["lobby", "control-room", "lobby", "gallery-a"],
  g2: ["gallery-b", "corridor", "secure-room", "corridor"],
  g3: ["control-room", "lobby", "control-room", "corridor"],
};

function App() {
  const [command, setCommand] = useState("");
  const [feed, setFeed] = useState<FeedItem[]>(initialFeed);
  const [crewRooms, setCrewRooms] = useState<Record<CrewName, Room>>({
    maya: "gallery-a",
    kai: "control-room",
    rex: "exit",
  });
  const [guardRooms, setGuardRooms] = useState<Record<GuardName, Room>>(initialGuards);
  const [cameraOn, setCameraOn] = useState<CameraState>({ 1: true, 2: true, 3: true });
  const [alert, setAlert] = useState(18);
  const [detection, setDetection] = useState(0);
  const [timeLeft, setTimeLeft] = useState(900);
  const [targetSecured, setTargetSecured] = useState(false);
  const [gameStatus, setGameStatus] = useState<GameStatus>("active");
  const [missionRun, setMissionRun] = useState(0);
  const [interpreting, setInterpreting] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showBriefing, setShowBriefing] = useState(true);

  // V1 #3 game-feel state
  const [routePreview, setRoutePreview] = useState<Room[]>([]);
  const [movingRoom, setMovingRoom] = useState<Room | null>(null);
  const [complication, setComplication] = useState<string | null>(null);

  const mayaRoomRef = useRef<Room>("gallery-a");
  const guardRoomsRef = useRef<Record<GuardName, Room>>(initialGuards);
  const cameraOnRef = useRef<CameraState>({ 1: true, 2: true, 3: true });
  const gameStatusRef = useRef<GameStatus>("active");
  const targetSecuredRef = useRef(false);
  const detectionRef = useRef(0);
  const threatGuardRef = useRef<GuardName | null>(null);
  const eventFeedRef = useRef<HTMLDivElement | null>(null);
  const pausedRef = useRef(false);
  const interpretingRef = useRef(false);
  const showBriefingRef = useRef(true);
  const guardStepRef = useRef<Record<GuardName, number>>({ g1: 0, g2: 0, g3: 0 });
  const complicationTriggeredRef = useRef(false);
  const complicationHideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    mayaRoomRef.current = crewRooms.maya;
  }, [crewRooms.maya]);

  useEffect(() => {
    guardRoomsRef.current = guardRooms;
  }, [guardRooms]);

  useEffect(() => {
    cameraOnRef.current = cameraOn;
  }, [cameraOn]);

  useEffect(() => {
    gameStatusRef.current = gameStatus;
  }, [gameStatus]);

  useEffect(() => {
    targetSecuredRef.current = targetSecured;
  }, [targetSecured]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    interpretingRef.current = interpreting;
  }, [interpreting]);

  useEffect(() => {
    showBriefingRef.current = showBriefing;
  }, [showBriefing]);

  useEffect(() => {
    const panel = eventFeedRef.current;
    if (!panel) return;
    panel.scrollTop = panel.scrollHeight;
  }, [feed]);

  useEffect(() => {
    return () => {
      if (complicationHideTimerRef.current !== null) {
        window.clearTimeout(complicationHideTimerRef.current);
      }
    };
  }, []);

  function addFeed(speaker: string, message: string) {
    setFeed((current) => [
      ...current,
      { id: Date.now() + Math.random(), speaker, message },
    ]);
  }

  function sleep(ms: number) {
    return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
  }

  function simulationBlocked() {
    return (
      showBriefingRef.current ||
      pausedRef.current ||
      interpretingRef.current ||
      gameStatusRef.current !== "active"
    );
  }

  // TIMER
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (simulationBlocked()) return;

      setTimeLeft((current) => {
        if (current <= 1) {
          gameStatusRef.current = "lost";
          setGameStatus("lost");
          addFeed("SYSTEM", "Mission failed. Time expired.");
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [missionRun]);

  // LIVE GUARD PATROL
  // Guided tutorial rule: guards stay frozen through Steps 1-3.
  // Full patrol begins only after the Orion Diamond is secured (Step 4).
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (simulationBlocked()) return;
      if (!targetSecuredRef.current) return;

      const next = { ...guardRoomsRef.current };

      (Object.keys(guardPaths) as GuardName[]).forEach((guard) => {
        guardStepRef.current[guard] =
          (guardStepRef.current[guard] + 1) % guardPaths[guard].length;
        next[guard] = guardPaths[guard][guardStepRef.current[guard]];
      });

      guardRoomsRef.current = next;
      setGuardRooms(next);
    }, 6000);

    return () => window.clearInterval(interval);
  }, [missionRun]);

  // DETECTION SYSTEM
  // Steps 1-3 are a learning phase: no guard detection can end the tutorial.
  // Detection becomes live after the diamond is secured for the escape phase.
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (simulationBlocked()) return;

      if (!targetSecuredRef.current) {
        if (detectionRef.current !== 0) {
          detectionRef.current = 0;
          setDetection(0);
        }
        threatGuardRef.current = null;
        return;
      }

      const mayaRoom = mayaRoomRef.current;
      const guardEntry = (Object.entries(guardRoomsRef.current) as [GuardName, Room][]).find(
        ([, room]) => room === mayaRoom,
      );

      if (guardEntry) {
        const [guardName] = guardEntry;

        if (threatGuardRef.current !== guardName) {
          threatGuardRef.current = guardName;
          addFeed(
            "Maya",
            `${guardName.toUpperCase()} has eyes on me in ${roomNames[mayaRoom]}. I need to move!`,
          );
          addFeed(
            "SYSTEM",
            "Detection rising. Move Maya out of the room before it reaches 100%.",
          );
        }

        const nextDetection = Math.min(100, detectionRef.current + 10);
        detectionRef.current = nextDetection;
        setDetection(nextDetection);

        if (nextDetection >= 100) {
          gameStatusRef.current = "lost";
          setAlert(100);
          setGameStatus("lost");
          addFeed(
            "SYSTEM",
            `${guardName.toUpperCase()} identified Maya. Mission compromised.`,
          );
        }
      } else if (detectionRef.current > 0) {
        const nextDetection = Math.max(0, detectionRef.current - 12);
        detectionRef.current = nextDetection;
        setDetection(nextDetection);

        if (nextDetection === 0 && threatGuardRef.current) {
          addFeed("Maya", "I broke line of sight. I'm clear again.");
          threatGuardRef.current = null;
        }
      } else {
        threatGuardRef.current = null;
      }
    }, 500);

    return () => window.clearInterval(interval);
  }, [missionRun]);

  // ALERT FAILURE
  // The guided learning phase cannot fail from alert. Failure rules turn on
  // after the diamond is secured and the player starts the escape phase.
  useEffect(() => {
    if (!targetSecured) return;
    if (alert < 100 || gameStatus !== "active") return;
    gameStatusRef.current = "lost";
    setGameStatus("lost");
  }, [alert, gameStatus, targetSecured]);

  // V1 #3 RANDOM COMPLICATION — once per mission after 35 active seconds
  useEffect(() => {
    if (
      showBriefing ||
      gameStatus !== "active" ||
      !targetSecured ||
      complicationTriggeredRef.current ||
      timeLeft > 830
    ) {
      return;
    }

    complicationTriggeredRef.current = true;
    triggerRandomComplication();
  }, [timeLeft, gameStatus, targetSecured, showBriefing]);

  function showComplication(message: string) {
    setComplication(message);

    if (complicationHideTimerRef.current !== null) {
      window.clearTimeout(complicationHideTimerRef.current);
    }

    complicationHideTimerRef.current = window.setTimeout(() => {
      setComplication(null);
      complicationHideTimerRef.current = null;
    }, 8000);
  }

  function securitySweep() {
    const guards: GuardName[] = ["g1", "g2", "g3"];
    const guard = guards[Math.floor(Math.random() * guards.length)];
    const currentRoom = guardRoomsRef.current[guard];
    const choices = roomConnections[currentRoom].filter((room) => room !== "exit");
    const destination = choices[Math.floor(Math.random() * choices.length)] ?? currentRoom;

    const next = { ...guardRoomsRef.current, [guard]: destination };
    guardRoomsRef.current = next;
    setGuardRooms(next);

    const message = `SECURITY SWEEP — ${guard.toUpperCase()} rerouted to ${roomNames[destination]}`;
    showComplication(message);
    addFeed("SYSTEM", message);
    addFeed("Maya", "Patrol pattern just changed. Rechecking my route.");
  }

  function triggerRandomComplication() {
    const roll = Math.floor(Math.random() * 3);

    if (roll === 0) {
      const offlineCameras = ([1, 2, 3] as CameraId[]).filter(
        (camera) => !cameraOnRef.current[camera],
      );

      if (offlineCameras.length > 0) {
        const camera = offlineCameras[Math.floor(Math.random() * offlineCameras.length)];
        const next = { ...cameraOnRef.current, [camera]: true };
        cameraOnRef.current = next;
        setCameraOn(next);
        showComplication(`CAMERA REBOOT — CAM ${camera} is live again`);
        addFeed("SYSTEM", `Unexpected camera reboot. Camera ${camera} is live again.`);
        addFeed("Kai", `CAM ${camera} just came back online. That wasn't me.`);
        return;
      }

      securitySweep();
      return;
    }

    if (roll === 1) {
      securitySweep();
      return;
    }

    setAlert((current) => Math.min(92, current + 8));
    showComplication("SECURITY PROTOCOL SHIFT — ALERT +8%");
    addFeed("SYSTEM", "Museum security tightened its internal protocol. Alert increased by 8%.");
    addFeed("Rex", "They're tightening the net. Don't turn this into a long night.");
  }

  function roomCost(room: Room) {
    if (Object.values(guardRoomsRef.current).includes(room)) return Infinity;

    let cost = 1;
    const camera = cameraMap[room];
    if (camera && cameraOnRef.current[camera]) cost += 4;
    return cost;
  }

  function findSafestPath(start: Room, destination: Room): Room[] | null {
    const distances = new Map<Room, number>();
    const previous = new Map<Room, Room>();
    const unvisited = new Set<Room>(Object.keys(roomConnections) as Room[]);

    (Object.keys(roomConnections) as Room[]).forEach((room) => {
      distances.set(room, room === start ? 0 : Infinity);
    });

    while (unvisited.size > 0) {
      let current: Room | null = null;
      let smallest = Infinity;

      unvisited.forEach((room) => {
        const distance = distances.get(room) ?? Infinity;
        if (distance < smallest) {
          smallest = distance;
          current = room;
        }
      });

      if (current === null || smallest === Infinity) break;

      const currentRoom = current as Room;
      unvisited.delete(currentRoom);
      if (currentRoom === destination) break;

      for (const neighbor of roomConnections[currentRoom]) {
        if (!unvisited.has(neighbor)) continue;

        const cost = roomCost(neighbor);
        if (cost === Infinity) continue;

        const alternative = smallest + cost;
        if (alternative < (distances.get(neighbor) ?? Infinity)) {
          distances.set(neighbor, alternative);
          previous.set(neighbor, currentRoom);
        }
      }
    }

    if (destination !== start && !previous.has(destination)) return null;

    const path: Room[] = [destination];
    let cursor = destination;

    while (cursor !== start) {
      const prev = previous.get(cursor);
      if (!prev) return null;
      path.unshift(prev);
      cursor = prev;
    }

    return path;
  }

  async function waitUntilClear(room: Room, maxWait = 12000) {
    const started = Date.now();
    let announced = false;

    while (Date.now() - started < maxWait) {
      if (gameStatusRef.current !== "active") return false;

      const occupied = Object.values(guardRoomsRef.current).includes(room);
      if (!occupied) {
        if (announced) addFeed("Maya", `${roomNames[room]} is clear now.`);
        return true;
      }

      if (!announced) {
        announced = true;
        addFeed("Maya", `Holding. A guard is in ${roomNames[room]}.`);
      }

      await sleep(500);
    }

    addFeed("Maya", `${roomNames[room]} is still blocked. I'm staying put.`);
    return false;
  }

  function moveMayaOneStep(destination: Room) {
    if (gameStatusRef.current !== "active") return false;

    const currentRoom = mayaRoomRef.current;

    if (destination === currentRoom) {
      addFeed("Maya", `I'm already in ${roomNames[destination]}.`);
      return true;
    }

    if (!roomConnections[currentRoom].includes(destination)) {
      addFeed(
        "Maya",
        `I can't move directly from ${roomNames[currentRoom]} to ${roomNames[destination]}.`,
      );
      return false;
    }

    if (Object.values(guardRoomsRef.current).includes(destination)) {
      addFeed("Maya", `${roomNames[destination]} isn't clear. A guard is there.`);
      return false;
    }

    setMovingRoom(destination);
    window.setTimeout(() => {
      setMovingRoom((current) => (current === destination ? null : current));
    }, 650);

    mayaRoomRef.current = destination;
    setCrewRooms((current) => ({ ...current, maya: destination }));
    addFeed("Maya", `Moving to ${roomNames[destination]}.`);

    const camera = cameraMap[destination];
    if (camera && cameraOnRef.current[camera]) {
      setAlert((current) => Math.min(100, current + 12));
      addFeed(
        "SYSTEM",
        `Camera ${camera} detected Maya entering ${roomNames[destination]}. Alert increased.`,
      );
    }

    if (destination === "exit" && targetSecuredRef.current) {
      gameStatusRef.current = "won";
      setGameStatus("won");
      addFeed(
        "SYSTEM",
        "MISSION COMPLETE. Orion Diamond recovered and Maya reached extraction.",
      );
    }

    return true;
  }

  async function followSafeRoute(destination: Room) {
    const start = mayaRoomRef.current;
    const path = findSafestPath(start, destination);

    if (!path) {
      addFeed("Maya", `I don't have a safe route to ${roomNames[destination]} right now.`);
      return;
    }

    if (path.length <= 1) {
      addFeed("Maya", `I'm already at ${roomNames[destination]}.`);
      return;
    }

    setRoutePreview(path);
    addFeed("Maya", `Safest route: ${path.map((room) => roomNames[room]).join(" → ")}.`);

    try {
      for (let i = 1; i < path.length; i += 1) {
        if (gameStatusRef.current !== "active") return;

        const nextRoom = path[i];
        const clear = await waitUntilClear(nextRoom, 10000);
        if (!clear) return;

        const moved = moveMayaOneStep(nextRoom);
        if (!moved) return;

        await sleep(700);
      }
    } finally {
      window.setTimeout(() => setRoutePreview([]), 900);
    }
  }

  function disableCamera(camera: CameraId) {
    if (!cameraOnRef.current[camera]) {
      addFeed("Kai", `Camera ${camera} is already offline.`);
      return;
    }

    const next = { ...cameraOnRef.current, [camera]: false };
    cameraOnRef.current = next;
    setCameraOn(next);
    addFeed("Kai", `Camera ${camera} disabled. Blind spot confirmed.`);
  }

  function secureTarget() {
    if (mayaRoomRef.current !== "secure-room") {
      addFeed("Maya", "I need to be inside the Secure Room before I can reach the target.");
      return;
    }

    if (targetSecuredRef.current) {
      addFeed("Maya", "I already have the Orion Diamond.");
      return;
    }

    targetSecuredRef.current = true;
    setTargetSecured(true);

    // Step 3 complete: switch from the safe tutorial phase to the live escape phase.
    addFeed("SYSTEM", "Diamond secured. Tutorial phase complete — live security is now active. Reach the EXIT.");

    if (cameraOnRef.current[3]) {
      setAlert((current) => Math.min(100, current + 25));
      addFeed(
        "Maya",
        "Target secured, but Camera 3 caught the movement. Security is reacting.",
      );
    } else {
      addFeed("Maya", "Target secured. Orion Diamond is with me.");
    }
  }

  async function callAIInterpreter(playerCommand: string): Promise<AIResponse> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch("http://127.0.0.1:3001/api/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          command: playerCommand,
          gameState: {
            mayaRoom: mayaRoomRef.current,
            kaiRoom: crewRooms.kai,
            rexRoom: crewRooms.rex,
            guards: guardRoomsRef.current,
            cameras: {
              1: cameraOnRef.current[1],
              2: cameraOnRef.current[2],
              3: cameraOnRef.current[3],
            },
            targetSecured: targetSecuredRef.current,
            alert,
            detection: detectionRef.current,
            timeLeft,
          },
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "AI server request failed.");
      }

      return response.json();
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function executeAIAction(action: AIAction) {
    if (gameStatusRef.current !== "active") return;

    switch (action.type) {
      case "disable-camera":
        if (action.camera === 1 || action.camera === 2 || action.camera === 3) {
          disableCamera(action.camera);
        }
        break;

      case "move":
        if (action.room !== "none") moveMayaOneStep(action.room);
        break;

      case "safe-route":
        if (action.room !== "none") await followSafeRoute(action.room);
        break;

      case "wait-move": {
        if (action.room === "none") break;
        addFeed("Maya", `I'll wait until ${roomNames[action.room]} is clear.`);
        const clear = await waitUntilClear(action.room, 12000);
        if (clear) moveMayaOneStep(action.room);
        break;
      }

      case "secure-target":
        secureTarget();
        break;

      case "hold": {
        const seconds = Math.max(1, Math.min(action.seconds || 3, 10));
        addFeed("Maya", `Holding position for ${seconds} seconds.`);
        await sleep(seconds * 1000);
        if (gameStatusRef.current === "active") addFeed("Maya", "Still in position.");
        break;
      }

      case "prepare-exit":
        addFeed("Rex", "Vehicle ready. Engine running. Extraction route standing by.");
        break;

      case "status":
        addFeed(
          "SYSTEM",
          `Alert ${alert}%. Detection ${detectionRef.current}%. Target ${
            targetSecuredRef.current ? "secured" : "not secured"
          }. Maya is at ${roomNames[mayaRoomRef.current]}.`,
        );
        break;

      case "unknown":
        addFeed("AI", "I couldn't map part of that instruction to a valid crew action.");
        break;
    }
  }

  async function sendCommand(event: FormEvent) {
    event.preventDefault();

    const cleanCommand = command.trim();
    if (!cleanCommand || interpreting || paused) return;

    addFeed("DIRECTOR", cleanCommand);
    setCommand("");

    if (gameStatusRef.current !== "active") return;

    interpretingRef.current = true;
    setInterpreting(true);

    try {
      const result = await callAIInterpreter(cleanCommand);

      // Resume the simulation before executing game actions so wait-move and patrol timing still work.
      interpretingRef.current = false;
      setInterpreting(false);

      const crewMessages = result.crewMessages ?? [];
      const actions = result.actions ?? [];

      // Let the crew speak directly. Action acknowledgements are hidden when the
      // game engine is about to show the same action (for example "Moving to...").
      for (const crewMessage of crewMessages) {
        const redundantAcknowledgement =
          crewMessage.kind === "acknowledgement" && actions.length > 0;

        if (!redundantAcknowledgement) {
          addFeed(crewMessage.speaker.toUpperCase(), crewMessage.message);
        }
      }

      // Keep an AI fallback only when no crew member had anything useful to say.
      if (crewMessages.length === 0 && result.summary) {
        addFeed("AI", result.summary);
      }

      for (const action of actions) {
        if (gameStatusRef.current !== "active") break;
        await executeAIAction(action);
        await sleep(400);
      }
    } catch (error) {
      console.error(error);
      const message =
        error instanceof DOMException && error.name === "AbortError"
          ? "AI response timed out. Try the command again."
          : "AI connection failed. Make sure server.mjs is running on port 3001.";
      addFeed("SYSTEM", message);
    } finally {
      interpretingRef.current = false;
      setInterpreting(false);
    }
  }

  function restartMission() {
    setCommand("");
    setFeed(initialFeed);

    mayaRoomRef.current = "gallery-a";
    setCrewRooms({ maya: "gallery-a", kai: "control-room", rex: "exit" });

    guardRoomsRef.current = { ...initialGuards };
    setGuardRooms({ ...initialGuards });
    guardStepRef.current = { g1: 0, g2: 0, g3: 0 };

    const startingCameras: CameraState = { 1: true, 2: true, 3: true };
    cameraOnRef.current = startingCameras;
    setCameraOn(startingCameras);

    targetSecuredRef.current = false;
    setTargetSecured(false);

    detectionRef.current = 0;
    setDetection(0);
    threatGuardRef.current = null;

    gameStatusRef.current = "active";
    setGameStatus("active");

    pausedRef.current = false;
    setPaused(false);
    interpretingRef.current = false;
    setInterpreting(false);
    showBriefingRef.current = true;
    setShowBriefing(true);

    setAlert(18);
    setTimeLeft(900);
    setRoutePreview([]);
    setMovingRoom(null);
    setComplication(null);
    complicationTriggeredRef.current = false;

    if (complicationHideTimerRef.current !== null) {
      window.clearTimeout(complicationHideTimerRef.current);
      complicationHideTimerRef.current = null;
    }

    setMissionRun((current) => current + 1);
  }

  function startMission() {
    showBriefingRef.current = false;
    setShowBriefing(false);
    addFeed(
      "SYSTEM",
      "Director online. Follow the guided objectives. You can phrase commands naturally.",
    );
  }

  function togglePause() {
    if (showBriefing || gameStatusRef.current !== "active" || interpreting) return;

    // Do not put side effects inside a React state updater. In development
    // Strict Mode may call updater functions twice, which duplicated radio logs.
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    addFeed("SYSTEM", next ? "Mission paused." : "Mission resumed.");
  }

  function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
  }

  function guardInRoom(room: Room) {
    return Object.values(guardRooms).includes(room);
  }

  function roomClass(room: Room, baseClass: string) {
    const classes = ["room", baseClass];
    if (routePreview.includes(room)) classes.push("route-preview");
    if (movingRoom === room) classes.push("moving-room");
    if (guardInRoom(room)) classes.push("guard-zone");
    if (crewRooms.maya === room && guardInRoom(room)) classes.push("contact-zone");
    return classes.join(" ");
  }

  function feedClass(speaker: string) {
    const safe = speaker.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    return `feed-item feed-${safe}${speaker === "DIRECTOR" ? " director-message" : ""}`;
  }

  function renderCrew(room: Room) {
    return (
      <>
        {crewRooms.maya === room && <div className="crew-token maya-token">M</div>}
        {crewRooms.kai === room && <div className="crew-token kai-token">K</div>}
        {crewRooms.rex === room && <div className="crew-token rex-token">R</div>}
      </>
    );
  }

  function renderGuards(room: Room) {
    return (
      <>
        {guardRooms.g1 === room && <div className="guard guard-a">G1</div>}
        {guardRooms.g2 === room && <div className="guard guard-b">G2</div>}
        {guardRooms.g3 === room && <div className="guard guard-c">G3</div>}
      </>
    );
  }

  const vaultCameraDisabled = !cameraOn[3];
  const mayaReachedVault = crewRooms.maya === "secure-room" || targetSecured;
  const missionExtracted = gameStatus === "won";

  const guideStep = !vaultCameraDisabled
    ? 1
    : !mayaReachedVault
      ? 2
      : !targetSecured
        ? 3
        : 4;

  const nextGuideCommand =
    guideStep === 1
      ? "Kai disable the vault camera"
      : guideStep === 2
        ? "Maya take the safest route to the vault"
        : guideStep === 3
          ? "Maya grab the diamond"
          : "Maya take the safest route to the exit";

  const nextGuideText =
    guideStep === 1
      ? "First, make the vault safer by taking Camera 3 offline."
      : guideStep === 2
        ? "Now guide Maya to the Secure Room without walking into a guard."
        : guideStep === 3
          ? "Maya is at the vault. Secure the Orion Diamond."
          : "You have the diamond. Get Maya to the EXIT to finish the mission.";

  const appClasses = [
    "app-shell",
    alert >= 70 ? "high-alert" : "",
    detection > 0 ? "under-detection" : "",
    paused ? "is-paused" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className={appClasses}>
      {showBriefing && gameStatus === "active" && (
        <div className="briefing-overlay">
          <div className="briefing-card">
            <span className="briefing-kicker">OPERATION: SILENT GALLERY</span>
            <h2>YOU ARE THE DIRECTOR</h2>
            <p className="briefing-lead">
              You do not control Maya with WASD. Type natural-language orders to your crew and
              guide the heist from the command desk.
            </p>

            <div className="briefing-goal">
              <span>MISSION</span>
              <strong>Steal the Orion Diamond and get Maya to the EXIT.</strong>
            </div>

            <div className="briefing-grid">
              <div>
                <strong>1 · KAI</strong>
                <span>Disable cameras</span>
              </div>
              <div>
                <strong>2 · MAYA</strong>
                <span>Move safely through the museum</span>
              </div>
              <div>
                <strong>3 · MAYA</strong>
                <span>Grab the diamond</span>
              </div>
              <div>
                <strong>4 · REX / MAYA</strong>
                <span>Prepare and reach extraction</span>
              </div>
            </div>

            <div className="briefing-warning">
              Guards patrol live. If DETECTION reaches 100%, the mission fails. Maya can refuse
              reckless orders when a room is clearly guarded.
            </div>

            <div className="briefing-first-command">
              <span>YOUR FIRST COMMAND</span>
              <code>Kai disable the vault camera</code>
            </div>

            <button className="briefing-start" onClick={startMission}>
              START MISSION
            </button>
          </div>
        </div>
      )}

      {gameStatus !== "active" && (
        <div className="mission-overlay">
          <div className={`mission-result ${gameStatus === "won" ? "mission-win" : "mission-loss"}`}>
            <span className="result-label">
              {gameStatus === "won" ? "OPERATION SUCCESS" : "OPERATION FAILED"}
            </span>
            <h2>{gameStatus === "won" ? "ORION DIAMOND RECOVERED" : "MISSION COMPROMISED"}</h2>
            <p>
              {gameStatus === "won"
                ? `Extraction complete with ${formatTime(timeLeft)} remaining and ${alert}% alert.`
                : "Maya was identified by security or the mission was compromised."}
            </p>
            <div className="result-stats">
              <div><span>TARGET</span><strong>{targetSecured ? "SECURED" : "LOST"}</strong></div>
              <div><span>ALERT</span><strong>{alert}%</strong></div>
              <div><span>TIME</span><strong>{formatTime(timeLeft)}</strong></div>
            </div>
            <button onClick={restartMission}>RESTART MISSION</button>
          </div>
        </div>
      )}

      <header className="top-bar">
        <div className="brand">
          <div className="brand-mark">HD</div>
          <div>
            <h1>HEIST DIRECTOR</h1>
            <p>Operation: Silent Gallery</p>
          </div>
        </div>

        <div className="top-actions">
          <button className="top-pause-button" onClick={togglePause} disabled={interpreting || showBriefing}>
            {paused ? "RESUME" : "PAUSE"}
          </button>
          <button className="top-restart-button" onClick={restartMission}>RESTART</button>
        </div>

        <div className="mission-stats">
          <div className="stat"><span>TIME LEFT</span><strong>{formatTime(timeLeft)}</strong></div>
          <div className="stat"><span>ALERT</span><strong className="alert-value">{alert}%</strong></div>
          <div className="stat">
            <span>DETECTION</span>
            <strong className={detection > 0 ? "detection-value danger" : "detection-value"}>{detection}%</strong>
          </div>
          <div className="stat">
            <span>TARGET</span>
            <strong className={targetSecured ? "target-secured" : ""}>{targetSecured ? "SECURED" : "NOT SECURED"}</strong>
          </div>
        </div>
      </header>

      {paused && <div className="pause-banner">MISSION PAUSED — guards, timer and detection are frozen</div>}
      {complication && <div className="complication-banner">⚠ {complication}</div>}

      <section className="game-grid">
        <aside className="panel crew-panel">
          <div className="panel-heading"><span>CREW</span><span className="online">3 ONLINE</span></div>
          <div className="crew-list">
            <article className="crew-card">
              <div className="crew-avatar">M</div>
              <div className="crew-info">
                <div className="crew-name-row"><strong>Maya</strong><span>Scout</span></div>
                <p>At {roomNames[crewRooms.maya]}</p>
                <div className="crew-status"><span className="status-dot" />Connected</div>
              </div>
            </article>
            <article className="crew-card">
              <div className="crew-avatar">K</div>
              <div className="crew-info">
                <div className="crew-name-row"><strong>Kai</strong><span>Tech</span></div>
                <p>Network access active</p>
                <div className="crew-status"><span className="status-dot" />Connected</div>
              </div>
            </article>
            <article className="crew-card">
              <div className="crew-avatar">R</div>
              <div className="crew-info">
                <div className="crew-name-row"><strong>Rex</strong><span>Driver</span></div>
                <p>Vehicle ready</p>
                <div className="crew-status"><span className="status-dot" />Connected</div>
              </div>
            </article>
          </div>
          <div className="mission-card guided-mission-card">
            <div className="guided-title-row">
              <span className="small-label">GUIDED FIRST MISSION</span>
              <span className="guide-step-badge">STEP {guideStep} / 4</span>
            </div>
            <strong>Recover Orion Diamond</strong>

            <div className="objective-list">
              <div className={vaultCameraDisabled ? "objective done" : guideStep === 1 ? "objective current" : "objective"}>
                <span>{vaultCameraDisabled ? "✓" : "1"}</span>
                <p>Disable vault camera</p>
              </div>
              <div className={mayaReachedVault ? "objective done" : guideStep === 2 ? "objective current" : "objective"}>
                <span>{mayaReachedVault ? "✓" : "2"}</span>
                <p>Get Maya to Secure Room</p>
              </div>
              <div className={targetSecured ? "objective done" : guideStep === 3 ? "objective current" : "objective"}>
                <span>{targetSecured ? "✓" : "3"}</span>
                <p>Secure Orion Diamond</p>
              </div>
              <div className={missionExtracted ? "objective done" : guideStep === 4 ? "objective current" : "objective"}>
                <span>{missionExtracted ? "✓" : "4"}</span>
                <p>Reach EXIT</p>
              </div>
            </div>
          </div>
        </aside>

        <section className="panel map-panel">
          <div className="panel-heading">
            <span>MUSEUM MAP</span>
            <span>
              {paused
                ? "PAUSED"
                : interpreting
                  ? "AI INTERPRETING"
                  : complication
                    ? "⚠ COMPLICATION"
                    : routePreview.length > 1
                      ? "TACTICAL ROUTE"
                      : detection > 0
                        ? "⚠ SECURITY WATCH"
                        : gameStatus === "active"
                          ? "LIVE FEED"
                          : gameStatus === "won"
                            ? "MISSION COMPLETE"
                            : "MISSION FAILED"}
            </span>
          </div>

          <div className={`museum-map ${detection > 0 ? "danger-state" : ""}`}>
            <div className="detection-meter">
              <div className="detection-meter-label"><span>SECURITY DETECTION</span><strong>{detection}%</strong></div>
              <div className="detection-track"><div className="detection-fill" style={{ width: `${detection}%` }} /></div>
            </div>

            <div className={roomClass("lobby", "lobby")}>
              <span className="room-label">LOBBY</span>
              {renderCrew("lobby")}{renderGuards("lobby")}
            </div>

            <div className={roomClass("gallery-a", "gallery-a")}>
              <span className="room-label">GALLERY A</span>
              {renderCrew("gallery-a")}{renderGuards("gallery-a")}
              <div className={`camera camera-one ${cameraOn[1] ? "camera-live" : "camera-off"}`}>
                {cameraOn[1] ? "CAM 1" : "CAM 1 OFF"}
              </div>
            </div>

            <div className={roomClass("gallery-b", "gallery-b")}>
              <span className="room-label">GALLERY B</span>
              {renderCrew("gallery-b")}{renderGuards("gallery-b")}
              <div className={`camera camera-two ${cameraOn[2] ? "camera-live" : "camera-off"}`}>
                {cameraOn[2] ? "CAM 2" : "CAM 2 OFF"}
              </div>
            </div>

            <div className={roomClass("control-room", "control-room")}>
              <span className="room-label">CONTROL</span>
              {renderCrew("control-room")}{renderGuards("control-room")}
            </div>

            <div className={roomClass("corridor", "corridor")}>
              <span className="room-label">CORRIDOR</span>
              {renderCrew("corridor")}{renderGuards("corridor")}
            </div>

            <div className={roomClass("secure-room", "secure-room")}>
              <span className="room-label">SECURE ROOM</span>
              {renderCrew("secure-room")}{renderGuards("secure-room")}
              {!targetSecured && <div className="target">◆</div>}
              <div className={`camera camera-three ${cameraOn[3] ? "camera-live" : "camera-off"}`}>
                {cameraOn[3] ? "CAM 3" : "CAM 3 OFF"}
              </div>
            </div>

            <div className={roomClass("exit", "exit-room")}>
              <span className="room-label">EXIT</span>
              {renderCrew("exit")}{renderGuards("exit")}
            </div>

            <div className="map-legend">
              <span><i className="legend-dot crew-legend" />Crew</span>
              <span><i className="legend-dot guard-legend" />Guard</span>
              <span><i className="legend-dot camera-legend" />Camera</span>
              <span><i className="legend-dot route-legend" />Safe route</span>
            </div>
          </div>
        </section>

        <aside className="panel feed-panel">
          <div className="panel-heading"><span>RADIO / EVENTS</span><span>LIVE</span></div>
          <div className="event-feed" ref={eventFeedRef}>
            {feed.map((item) => (
              <div className={feedClass(item.speaker)} key={item.id}>
                <span>{item.speaker}</span>
                <p>{item.message}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="command-section">
        <div className="guide-command-card">
          <div className="guide-command-copy">
            <span>NEXT OBJECTIVE · STEP {guideStep} OF 4</span>
            <strong>{nextGuideText}</strong>
            <code>{nextGuideCommand}</code>
          </div>
          <button
            type="button"
            onClick={() => setCommand(nextGuideCommand)}
            disabled={paused || interpreting || gameStatus !== "active"}
          >
            LOAD COMMAND
          </button>
        </div>

        <div className="command-label">
          <span>DIRECTOR COMMAND</span>
          <span>
            {paused
              ? "MISSION PAUSED"
              : interpreting
                ? "REAL AI INTERPRETING..."
                : "REAL AI COMMAND CHANNEL"}
          </span>
        </div>

        <form className="command-form" onSubmit={sendCommand}>
          <span className="prompt-symbol">&gt;</span>
          <input
            value={command}
            disabled={interpreting || paused}
            onChange={(event) => setCommand(event.target.value)}
            placeholder={paused ? "Resume the mission to issue commands..." : "Tell the crew what you want in your own words..."}
          />
          <button type="submit" disabled={interpreting || paused}>
            {interpreting ? "THINKING..." : "SEND COMMAND"}
          </button>
        </form>

        <div className="command-hints">
          Try:
          <span>Maya take the safest route to the vault</span>
          <span>Kai shut down the vault camera</span>
          <span>Maya hold position until the guard moves</span>
          <span>Maya get us out using the safest route</span>
        </div>
      </section>
    </main>
  );
}

export default App;
